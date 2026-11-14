/**
 * Canonicalize a job link so the same posting is never stored twice under different URLs.
 * Strips tracking params, fragments, trailing slashes, "www." and sorts remaining params.
 * Site-specific IDs (LinkedIn, Indeed, Glassdoor) collapse to a canonical form; params that
 * carry job identity on company career sites (gh_jid, jobId, id, …) are kept.
 */
const TRACKING_PARAMS = new Set([
  "fbclid", "gclid", "gclsrc", "dclid", "msclkid", "yclid", "mc_cid", "mc_eid", "igshid",
  "ref", "refid", "referrer", "referral", "trk", "trkinfo", "trackingid", "trkemail",
  "src", "source", "gh_src", "lever-source", "lever-origin", "lever-via", "_hsenc", "_hsmi",
  "cid", "campaign", "sid", "eid", "ebp", "alternatechannel", "origin", "savedsearchid",
  "pagenum", "from", "fromage", "vjs", "tk", "advn", "sjdu", "rtk", "bb", "ccid",
  "refererinfo", "ved", "ei", "sa", "usg", "li_fat_id", "ssid", "s_kwcid", "t", "tracking",
  "tracking_source", "recommendedflavor", "midtoken", "midsig", "trackingid", "refid",
]);

export function normalizeJobUrl(input: string): string {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("That doesn't look like a valid link.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only http(s) links are supported.");
  }

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  // LinkedIn: /jobs/view/<slug>-<id>/, or ?currentJobId=<id> on collection/search pages.
  if (host === "linkedin.com" || host.endsWith(".linkedin.com")) {
    const fromPath = url.pathname.match(/\/jobs\/view\/(?:[^/]*-)?(\d{6,})/);
    const id = fromPath?.[1] ?? url.searchParams.get("currentJobId");
    if (id && /^\d+$/.test(id)) return `https://linkedin.com/jobs/view/${id}`;
  }

  // Indeed: job identity is jk (or vjk on search pages).
  if (/(^|\.)indeed\.[a-z.]+$/.test(host)) {
    const jk = url.searchParams.get("jk") ?? url.searchParams.get("vjk");
    if (jk) return `https://${host}/viewjob?jk=${jk.toLowerCase()}`;
  }

  // Glassdoor: job identity is jl / jobListingId.
  if (/(^|\.)glassdoor\.[a-z.]+$/.test(host)) {
    const jl = url.searchParams.get("jl") ?? url.searchParams.get("jobListingId");
    if (jl) return `https://${host}/job-listing/?jl=${jl}`;
  }

  const params = [...url.searchParams.entries()]
    .filter(([k]) => !k.toLowerCase().startsWith("utm_") && !TRACKING_PARAMS.has(k.toLowerCase()))
    .sort(([a], [b]) => a.localeCompare(b));

  let path = url.pathname.replace(/\/{2,}/g, "/");
  if (path.length > 1) path = path.replace(/\/+$/, "");
  const port = url.port && url.port !== "80" && url.port !== "443" ? `:${url.port}` : "";
  const query = params.length ? "?" + params.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&") : "";
  return `https://${host}${port}${path}${query}`;
}
