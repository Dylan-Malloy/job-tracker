import "server-only";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 5;
const TIMEOUT_MS = 12_000;

export function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 192 && b === 0) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIp(mapped[1]);
  return v === "::" || v === "::1" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe8") ||
    v.startsWith("fe9") || v.startsWith("fea") || v.startsWith("feb");
}

// Validates every resolved address at connect time (also defeats DNS rebinding).
const safeLookup = ((hostname: string, options: dns.LookupOptions, cb: (...a: unknown[]) => void) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addrs) => {
    if (err) return cb(err);
    const list = addrs as dns.LookupAddress[];
    if (!list.length || list.some((a) => isPrivateIp(a.address))) {
      return cb(new Error("BLOCKED_ADDRESS"));
    }
    if (options.all) return cb(null, list);
    cb(null, list[0].address, list[0].family);
  });
}) as unknown as net.LookupFunction;

export type FetchResult =
  | { ok: true; status: number; finalUrl: string; contentType: string; body: string }
  | { ok: false; reason: "blocked_address" | "bad_url" | "http_error" | "network" | "not_html" | "too_large"; status?: number };

function requestOnce(url: URL): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string; truncated: boolean }> {
  return new Promise((resolve, reject) => {
    const lib = url.protocol === "https:" ? https : http;
    const req = lib.request(
      url,
      {
        method: "GET",
        lookup: safeLookup,
        timeout: TIMEOUT_MS,
        headers: {
          "user-agent": "Mozilla/5.0 (compatible; JobHubBot/1.0; +personal-job-tracker)",
          accept: "text/html,application/xhtml+xml",
          "accept-encoding": "identity",
          "accept-language": "en-US,en;q=0.9",
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        let size = 0;
        let truncated = false;
        res.on("data", (c: Buffer) => {
          size += c.length;
          if (size > MAX_BYTES) {
            truncated = true;
            res.destroy();
            return;
          }
          chunks.push(c);
        });
        const done = () =>
          resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8"), truncated });
        res.on("end", done);
        res.on("close", done);
        res.on("error", reject);
      },
    );
    req.on("timeout", () => req.destroy(new Error("TIMEOUT")));
    req.on("error", reject);
    req.end();
  });
}

export async function fetchPage(input: string): Promise<FetchResult> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return { ok: false, reason: "bad_url" };
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!["http:", "https:"].includes(url.protocol)) return { ok: false, reason: "bad_url" };
    if (url.port && !["80", "443"].includes(url.port)) return { ok: false, reason: "bad_url" };
    if (net.isIP(url.hostname.replace(/^\[|\]$/g, "")) && isPrivateIp(url.hostname.replace(/^\[|\]$/g, ""))) {
      return { ok: false, reason: "blocked_address" };
    }
    try {
      const res = await requestOnce(url);
      if ([301, 302, 303, 307, 308].includes(res.status) && res.headers.location) {
        url = new URL(res.headers.location, url);
        continue;
      }
      if (res.status >= 400) return { ok: false, reason: "http_error", status: res.status };
      const contentType = String(res.headers["content-type"] ?? "");
      if (!/html|xml|text/i.test(contentType)) return { ok: false, reason: "not_html" };
      return { ok: true, status: res.status, finalUrl: url.toString(), contentType, body: res.body };
    } catch (e) {
      if (e instanceof Error && e.message === "BLOCKED_ADDRESS") return { ok: false, reason: "blocked_address" };
      return { ok: false, reason: "network" };
    }
  }
  return { ok: false, reason: "network" };
}

/** Reduce an HTML page to readable text, keeping any schema.org JobPosting JSON-LD (very reliable when present). */
export function htmlToText(html: string): { text: string; hasJobPosting: boolean } {
  const ld: string[] = [];
  for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    if (/JobPosting/i.test(m[1])) ld.push(m[1].trim().slice(0, 12_000));
  }
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? "";
  const body = html
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|ul|ol)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  const text = [title && `Page title: ${title}`, ld.length && `JobPosting data:\n${ld.join("\n")}`, body]
    .filter(Boolean)
    .join("\n\n");
  return { text: text.slice(0, 60_000), hasJobPosting: ld.length > 0 };
}

export type ReadFailure = "login_wall" | "blocked" | "js_only" | "unreachable";

export function classifyUnreadable(html: string, text: string, hasJobPosting: boolean): ReadFailure | null {
  if (hasJobPosting) return null;
  const lower = text.toLowerCase();
  if (text.length < 500) {
    return /enable javascript|javascript is required|you need to enable/i.test(html) || html.length > 5000 ? "js_only" : "unreachable";
  }
  if (text.length < 2500 && /(sign in|log in|join now|create an account|authwall)/i.test(lower)) return "login_wall";
  if (/(access denied|captcha|are you a robot|unusual traffic|request blocked)/i.test(lower.slice(0, 1500))) return "blocked";
  return null;
}
