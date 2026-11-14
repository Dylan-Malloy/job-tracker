import { describe, expect, it } from "vitest";
import { normalizeJobUrl } from "./normalize";

describe("normalizeJobUrl", () => {
  it("strips utm params, fragments, www and trailing slash", () => {
    expect(normalizeJobUrl("http://www.Example.com/careers/dev/?utm_source=x&utm_medium=y#apply"))
      .toBe("https://example.com/careers/dev");
  });
  it("treats different tracking on the same job as identical", () => {
    const a = normalizeJobUrl("https://boards.acme.com/jobs?gh_jid=123&gh_src=abc&fbclid=1");
    const b = normalizeJobUrl("https://boards.acme.com/jobs/?gh_jid=123");
    expect(a).toBe(b);
    expect(a).toContain("gh_jid=123");
  });
  it("keeps distinct job ids distinct", () => {
    expect(normalizeJobUrl("https://acme.com/jobs?gh_jid=1")).not.toBe(normalizeJobUrl("https://acme.com/jobs?gh_jid=2"));
  });
  it("collapses LinkedIn variants", () => {
    const want = "https://linkedin.com/jobs/view/3812345678";
    expect(normalizeJobUrl("https://www.linkedin.com/jobs/view/senior-engineer-at-acme-3812345678/?trackingId=abc&refId=z")).toBe(want);
    expect(normalizeJobUrl("https://www.linkedin.com/jobs/collections/recommended/?currentJobId=3812345678")).toBe(want);
  });
  it("collapses Indeed and Glassdoor variants", () => {
    expect(normalizeJobUrl("https://www.indeed.com/viewjob?jk=ABC123&from=serp&vjs=3"))
      .toBe(normalizeJobUrl("https://indeed.com/?vjk=abc123&q=dev"));
    expect(normalizeJobUrl("https://www.glassdoor.com/job-listing/dev-acme-JV_IC1.htm?jl=99&src=GD_JOB_AD"))
      .toBe("https://glassdoor.com/job-listing/?jl=99");
  });
  it("sorts params and rejects bad input", () => {
    expect(normalizeJobUrl("https://a.com/j?b=2&a=1")).toBe("https://a.com/j?a=1&b=2");
    expect(() => normalizeJobUrl("not a url")).toThrow();
    expect(() => normalizeJobUrl("ftp://a.com/x")).toThrow();
  });
});
