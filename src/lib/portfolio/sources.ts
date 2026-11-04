import "server-only";
import {
  SourceFetchError,
  fetchGithub,
  fetchPublicPage,
  htmlToText,
  type GithubSummary,
  type PageText,
} from "./fetch";
import { parseGithubTarget } from "./github-target";

export type SourceError = SourceFetchError["code"];

/** One portfolio link as the model sees it: what could be read, or why not. */
export type PortfolioSource =
  | { kind: "github"; label: string; data: GithubSummary }
  | { kind: "website"; label: string; data: PageText & { url: string } }
  | { kind: "github" | "website"; label: string; error: SourceError };

function errorOf(error: unknown): SourceError {
  return error instanceof SourceFetchError ? error.code : "unreachable";
}

/** Reads every link in parallel; a link that fails becomes an entry with its error. */
export async function readSources(github: string | null, urls: string[]): Promise<PortfolioSource[]> {
  const jobs: Promise<PortfolioSource>[] = [];
  if (github) {
    const target = parseGithubTarget(github);
    const label = target ? `github.com/${target.owner}${target.repo ? `/${target.repo}` : ""}` : github;
    jobs.push(
      (target ? fetchGithub(target) : Promise.reject(new SourceFetchError("not_found"))).then(
        (data): PortfolioSource => ({ kind: "github", label, data }),
        (error): PortfolioSource => ({ kind: "github", label, error: errorOf(error) }),
      ),
    );
  }
  for (const url of urls) {
    jobs.push(
      fetchPublicPage(url).then(
        (page): PortfolioSource => ({ kind: "website", label: url, data: { url: page.url, ...htmlToText(page.body) } }),
        (error): PortfolioSource => ({ kind: "website", label: url, error: errorOf(error) }),
      ),
    );
  }
  return Promise.all(jobs);
}

export function isReadable(source: PortfolioSource): boolean {
  return !("error" in source);
}
