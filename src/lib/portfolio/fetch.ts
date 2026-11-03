import "server-only";
import { lookup } from "node:dns";
import http from "node:http";
import https from "node:https";
import { isIP, type LookupFunction } from "node:net";
import zlib from "node:zlib";

// Portfolio links are typed by users and fetched by our server, so every request is
// checked against server-side request forgery: only http(s) on default ports, and
// every address a hostname resolves to, on every redirect, must be public. The check
// runs inside the socket's own DNS lookup, so the address checked is the one connected to.

const TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "OptimizeCV-PortfolioReview/1.0";
export const MAX_SOURCE_CHARS = 12_000;

function isPublicIPv4(address: string): boolean {
  const [a, b] = address.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false; // carrier-grade NAT
  if (a === 169 && b === 254) return false; // link-local, cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 168 || b === 0)) return false;
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  return true;
}

export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPublicIPv4(address);
  if (version !== 6) return false;
  const ip = address.toLowerCase();
  if (ip === "::" || ip === "::1") return false;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) return isPublicIPv4(mapped[1]);
  const first = parseInt(ip.split(":")[0] || "0", 16);
  if ((first & 0xfe00) === 0xfc00) return false; // unique local
  if ((first & 0xffc0) === 0xfe80) return false; // link-local
  if ((first & 0xff00) === 0xff00) return false; // multicast
  return true;
}

export class SourceFetchError extends Error {
  constructor(readonly code: "blocked" | "unreachable" | "not_found" | "not_html" | "rate_limited") {
    super(code);
    this.name = "SourceFetchError";
  }
}

const publicLookup: LookupFunction = (hostname, options, callback) => {
  lookup(hostname, { ...options, all: true }, (error, addresses) => {
    if (error) return callback(error, "", 4);
    if (addresses.length === 0 || addresses.some((entry) => !isPublicAddress(entry.address))) {
      return callback(new SourceFetchError("blocked"), "", 4);
    }
    if (options.all) return callback(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

interface FetchedPage {
  url: string;
  contentType: string;
  body: string;
}

function requestOnce(url: URL, accept: string): Promise<{ status: number; location?: string; contentType: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === "https:" ? https : http;
    const request = client.get(
      url,
      { lookup: publicLookup, timeout: TIMEOUT_MS, headers: { "user-agent": USER_AGENT, accept, "accept-encoding": "gzip, deflate, br" } },
      (response) => {
        const status = response.statusCode ?? 0;
        const location = response.headers.location;
        if (status >= 300 && status < 400 && location) {
          response.resume();
          return resolve({ status, location, contentType: "", body: Buffer.alloc(0) });
        }
        const encoding = response.headers["content-encoding"];
        const stream =
          encoding === "gzip"
            ? response.pipe(zlib.createGunzip())
            : encoding === "br"
              ? response.pipe(zlib.createBrotliDecompress())
              : encoding === "deflate"
                ? response.pipe(zlib.createInflate())
                : response;
        const chunks: Buffer[] = [];
        let size = 0;
        let finished = false;
        const finish = () => {
          if (finished) return;
          finished = true;
          resolve({ status, contentType: String(response.headers["content-type"] ?? ""), body: Buffer.concat(chunks) });
        };
        stream.on("data", (chunk: Buffer) => {
          if (finished) return;
          // Enough to judge a page; the rest is cut off rather than failing.
          const room = MAX_BYTES - size;
          chunks.push(chunk.length > room ? chunk.subarray(0, room) : chunk);
          size += Math.min(chunk.length, room);
          if (size >= MAX_BYTES) {
            finish();
            response.destroy();
          }
        });
        stream.on("end", finish);
        stream.on("error", (error) => {
          if (!finished) reject(error);
        });
      },
    );
    request.on("timeout", () => request.destroy(new SourceFetchError("unreachable")));
    request.on("error", reject);
  });
}

/** Fetches a public web page, following redirects, under the rules above. */
export async function fetchPublicPage(input: string, accept = "text/html,text/plain;q=0.9"): Promise<FetchedPage> {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new SourceFetchError("blocked");
  }
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if ((url.protocol !== "http:" && url.protocol !== "https:") || url.port !== "" || url.username || url.password) {
      throw new SourceFetchError("blocked");
    }
    // Literal IPs skip the DNS lookup, so they are checked here.
    const host = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(host) && !isPublicAddress(host)) throw new SourceFetchError("blocked");

    let response;
    try {
      response = await requestOnce(url, accept);
    } catch (error) {
      throw error instanceof SourceFetchError ? error : new SourceFetchError("unreachable");
    }
    if (response.location) {
      url = new URL(response.location, url);
      continue;
    }
    if (response.status === 404 || response.status === 410) throw new SourceFetchError("not_found");
    if (response.status === 429) throw new SourceFetchError("rate_limited");
    if (response.status >= 400) throw new SourceFetchError("unreachable");
    if (!/text\/(html|plain)|application\/xhtml/.test(response.contentType)) throw new SourceFetchError("not_html");
    const charset = /charset=([\w-]+)/i.exec(response.contentType)?.[1] ?? "utf-8";
    let body: string;
    try {
      body = new TextDecoder(charset).decode(response.body);
    } catch {
      body = new TextDecoder().decode(response.body);
    }
    return { url: url.toString(), contentType: response.contentType, body };
  }
  throw new SourceFetchError("unreachable");
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|\w+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

function attribute(tag: string, name: string): string | null {
  const match = new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, "i").exec(tag);
  return match ? decodeEntities(match[2] ?? match[3] ?? "") : null;
}

export interface PageText {
  title: string | null;
  description: string | null;
  text: string;
  links: { text: string; href: string }[];
}

/** What a reader sees on a page: title, description, visible text and links. Rough, but needs no browser. */
export function htmlToText(html: string): PageText {
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const meta = html.match(/<meta\b[^>]*>/gi) ?? [];
  const descriptionTag = meta.find((tag) => /(name|property)\s*=\s*["'](og:)?description["']/i.test(tag));
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|template|iframe|head)\b[\s\S]*?<\/\1>/gi, " ");

  const links: PageText["links"] = [];
  for (const match of body.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = attribute(match[1], "href");
    const text = decodeEntities(match[2].replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
    if (href && !href.startsWith("#") && !href.startsWith("javascript:") && links.length < 40) links.push({ text, href });
  }

  const text = decodeEntities(
    body
      .replace(/<(br|hr)\b[^>]*>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "\n- ")
      .replace(/<\/(p|div|section|article|header|footer|li|ul|ol|h[1-6]|tr|table|blockquote|pre)>/gi, "\n")
      .replace(/<[^>]+>/g, " "),
  )
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n")
    .slice(0, MAX_SOURCE_CHARS);

  return {
    title: title ? decodeEntities(title).replace(/\s+/g, " ").trim() || null : null,
    description: descriptionTag ? attribute(descriptionTag, "content") : null,
    text,
    links,
  };
}

const GITHUB_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const GITHUB_REPO = /^[A-Za-z0-9._-]{1,100}$/;

/** A GitHub user or repository from a username, "@username" or github.com URL. */
export function parseGithubTarget(input: string): { owner: string; repo: string | null } | null {
  const value = input.trim().replace(/^@/, "");
  const fromUrl = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)(?:\/([^/?#]+))?/i.exec(value);
  const [owner, repo] = fromUrl ? [fromUrl[1], fromUrl[2]?.replace(/\.git$/, "") ?? null] : [value, null];
  if (!GITHUB_NAME.test(owner) || (repo !== null && !GITHUB_REPO.test(repo))) return null;
  return { owner, repo };
}

export interface GithubRepo {
  name: string;
  description: string | null;
  language: string | null;
  stars: number;
  forks: number;
  topics: string[];
  pushed_at: string;
  homepage: string | null;
  readme: string | null;
}

export interface GithubSummary {
  profile: { login: string; name: string | null; bio: string | null; public_repos: number; followers: number; blog: string | null; created_at: string };
  repos: GithubRepo[];
}

const README_CHARS = 3000;
const MAX_REPOS = 6;

async function github<T>(path: string, accept = "application/vnd.github+json"): Promise<T> {
  // GitHub's fixed host: no SSRF concern. A token raises the 60 requests/hour anonymous limit.
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com${path}`, {
    headers: { accept, "user-agent": USER_AGENT, "x-github-api-version": "2022-11-28", ...(token && { authorization: `Bearer ${token}` }) },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  }).catch(() => {
    throw new SourceFetchError("unreachable");
  });
  if (response.status === 404) throw new SourceFetchError("not_found");
  if (response.status === 403 || response.status === 429) throw new SourceFetchError("rate_limited");
  if (!response.ok) throw new SourceFetchError("unreachable");
  return (accept.endsWith("raw") ? response.text() : response.json()) as Promise<T>;
}

interface ApiRepo {
  name: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics?: string[];
  pushed_at: string;
  homepage: string | null;
  fork: boolean;
}

/** The profile and the most notable repositories with their READMEs, or one repository when the link names it. */
export async function fetchGithub({ owner, repo }: { owner: string; repo: string | null }): Promise<GithubSummary> {
  const [profile, repos] = await Promise.all([
    github<GithubSummary["profile"]>(`/users/${owner}`),
    repo
      ? github<ApiRepo>(`/repos/${owner}/${repo}`).then((one) => [one])
      : github<ApiRepo[]>(`/users/${owner}/repos?sort=pushed&per_page=50`),
  ]);
  const picked = repos
    .filter((item) => repo || !item.fork)
    .sort((a, b) => b.stargazers_count - a.stargazers_count || b.pushed_at.localeCompare(a.pushed_at))
    .slice(0, MAX_REPOS);
  const withReadmes = await Promise.all(
    picked.map(async (item) => ({
      name: item.name,
      description: item.description,
      language: item.language,
      stars: item.stargazers_count,
      forks: item.forks_count,
      topics: item.topics ?? [],
      pushed_at: item.pushed_at,
      homepage: item.homepage,
      readme: await github<string>(`/repos/${owner}/${item.name}/readme`, "application/vnd.github.raw")
        .then((text) => text.slice(0, README_CHARS))
        .catch(() => null),
    })),
  );
  const { login, name, bio, public_repos, followers, blog, created_at } = profile;
  return { profile: { login, name, bio, public_repos, followers, blog, created_at }, repos: withReadmes };
}
