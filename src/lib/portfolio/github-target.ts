// Shared by the server and the forms, which check a GitHub link before submitting.

const GITHUB_NAME = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const GITHUB_REPO = /^[A-Za-z0-9._-]{1,100}$/;

export interface GithubTarget {
  owner: string;
  repo: string | null;
}

/** A GitHub user or repository from a username, "@username" or github.com URL. */
export function parseGithubTarget(input: string): GithubTarget | null {
  const value = input.trim().replace(/^@/, "");
  const fromUrl = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#]+)(?:\/([^/?#]+))?/i.exec(value);
  const [owner, repo] = fromUrl ? [fromUrl[1], fromUrl[2]?.replace(/\.git$/, "") ?? null] : [value, null];
  if (!GITHUB_NAME.test(owner) || (repo !== null && !GITHUB_REPO.test(repo))) return null;
  return { owner, repo };
}
