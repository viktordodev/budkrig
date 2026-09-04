import { describe, expect, it } from "vitest";
import { parseTarget, withUtm } from "./target";

describe("parseTarget", () => {
  it("rejects empty input", () => {
    expect(parseTarget("   ")).toEqual({ ok: false, error: { kind: "empty" } });
  });

  it("derives host slug from a URL, stripping www / scheme / fragment", () => {
    expect(parseTarget("https://www.See.io/pricing#top")).toEqual({
      ok: true,
      value: { kind: "url", slug: "see.io", targetUrl: "https://see.io/pricing" },
    });
  });

  it("adds https:// to a bare domain", () => {
    expect(parseTarget("see.io")).toMatchObject({
      ok: true,
      value: { kind: "url", slug: "see.io", targetUrl: "https://see.io/" },
    });
  });

  it("keeps the query string", () => {
    const r = parseTarget("https://see.io/x?ref=1");
    expect(r.ok && r.value.targetUrl).toBe("https://see.io/x?ref=1");
  });

  it("parses a bare @handle", () => {
    expect(parseTarget("@Jonathan_Wilke")).toEqual({
      ok: true,
      value: { kind: "handle", slug: "@jonathan_wilke", targetUrl: "https://x.com/jonathan_wilke" },
    });
  });

  it("parses a plain word as a handle", () => {
    expect(parseTarget("budkrig")).toMatchObject({
      ok: true,
      value: { kind: "handle", slug: "@budkrig" },
    });
  });

  it("treats an x.com profile URL as a handle", () => {
    expect(parseTarget("https://x.com/jonathan_wilke/")).toMatchObject({
      ok: true,
      value: { kind: "handle", slug: "@jonathan_wilke" },
    });
    expect(parseTarget("https://twitter.com/budkrig")).toMatchObject({
      ok: true,
      value: { kind: "handle", slug: "@budkrig" },
    });
  });

  it("rejects a non-http scheme", () => {
    expect(parseTarget("ftp://see.io")).toEqual({
      ok: false,
      error: { kind: "unsupported_scheme" },
    });
  });

  it("rejects a hostname with no dot", () => {
    expect(parseTarget("http://localhost/foo")).toEqual({
      ok: false,
      error: { kind: "invalid_url" },
    });
  });
});

describe("withUtm", () => {
  it("adds utm_source when absent", () => {
    expect(withUtm("https://see.io/x")).toBe("https://see.io/x?utm_source=budkrig");
  });
  it("does not clobber an existing utm_source", () => {
    expect(withUtm("https://see.io/x?utm_source=other")).toBe("https://see.io/x?utm_source=other");
  });
});
