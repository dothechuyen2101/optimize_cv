import { describe, expect, it, vi } from "vitest";
import { fetchPublicPage, htmlToText, isPublicAddress } from "./fetch";
import { parseGithubTarget } from "./github-target";

vi.mock("server-only", () => ({}));

describe("isPublicAddress", () => {
  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "140.82.112.3", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) expect(isPublicAddress(ip)).toBe(true);
  });

  it("blocks private, loopback, link-local and reserved ranges", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
      "::ffff:10.0.0.1",
      "not-an-ip",
    ]) {
      expect(isPublicAddress(ip), ip).toBe(false);
    }
  });
});

describe("fetchPublicPage", () => {
  it("refuses local and non-web targets before connecting", async () => {
    for (const url of [
      "http://127.0.0.1/",
      "http://[::1]/",
      "http://169.254.169.254/latest/meta-data/",
      "http://localhost/",
      "file:///etc/passwd",
      "ftp://example.com/",
      "https://example.com:8443/",
      "https://user:pass@example.com/",
      "not a url",
    ]) {
      await expect(fetchPublicPage(url), url).rejects.toMatchObject({ code: "blocked" });
    }
  });
});

describe("htmlToText", () => {
  it("keeps what a reader sees and drops scripts, styles and markup", () => {
    const page = htmlToText(`<!doctype html><html><head><title>Lan &amp; Co · Portfolio</title>
      <meta name="description" content="Product designer &#8211; fintech"><style>.a{color:red}</style></head>
      <body><nav><a href="/work">Work</a> <a href="#top">Top</a></nav>
      <h1>Hi, I&#39;m Lan</h1><p>I design <b>payment</b> flows.<br>Based in Hà Nội.</p>
      <ul><li>Case study: MoMo checkout</li><li>Banking app</li></ul>
      <script>alert("x")</script><!-- hidden --></body></html>`);

    expect(page.title).toBe("Lan & Co · Portfolio");
    expect(page.description).toBe("Product designer – fintech");
    expect(page.text).toContain("Hi, I'm Lan");
    expect(page.text).toContain("I design payment flows.\nBased in Hà Nội.");
    expect(page.text).toContain("- Case study: MoMo checkout");
    expect(page.text).not.toMatch(/alert|color:red|hidden/);
    expect(page.links).toEqual([{ text: "Work", href: "/work" }]);
  });
});

describe("parseGithubTarget", () => {
  it("reads usernames, profile and repository links", () => {
    expect(parseGithubTarget("octocat")).toEqual({ owner: "octocat", repo: null });
    expect(parseGithubTarget("@octocat")).toEqual({ owner: "octocat", repo: null });
    expect(parseGithubTarget("https://github.com/octocat")).toEqual({ owner: "octocat", repo: null });
    expect(parseGithubTarget("github.com/octocat/Hello-World.git")).toEqual({ owner: "octocat", repo: "Hello-World" });
    expect(parseGithubTarget("https://www.github.com/octocat/hello.js/tree/main")).toEqual({ owner: "octocat", repo: "hello.js" });
  });

  it("rejects anything else", () => {
    for (const value of ["", "-bad", "a b", "https://gitlab.com/x", "octocat/../../etc", "x".repeat(40)]) {
      expect(parseGithubTarget(value), value).toBeNull();
    }
  });
});
