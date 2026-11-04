import { describe, expect, it } from "vitest";
import type { GithubProjects } from "@/lib/ai/schemas/github-projects";
import type { GithubRepoInfo } from "@/lib/portfolio/fetch";
import { makeJob, makeResume } from "@/test/fixtures";
import { MAX_CANDIDATES, finalizeProposals, rankRepos } from "./select";
import { toResumeProject } from "./types";

const NOW = new Date("2026-11-01T00:00:00Z");

function repo(name: string, overrides: Partial<GithubRepoInfo> = {}): GithubRepoInfo {
  return {
    name,
    description: null,
    language: null,
    stars: 0,
    forks: 0,
    topics: [],
    pushed_at: "2026-10-01T00:00:00Z",
    homepage: null,
    ...overrides,
  };
}

describe("rankRepos", () => {
  const job = makeJob();

  it("puts repositories showing the JD's skills first", () => {
    const ranked = rankRepos(
      [
        repo("recipe-app", { description: "Personal recipe notes", language: "Swift" }),
        repo("orders-service", { description: "Order microservices on Kubernetes", language: "TypeScript", topics: ["postgresql"] }),
        repo("blog", { description: "My blog" }),
      ],
      job,
      makeResume(),
      "octocat",
      NOW,
    );
    expect(ranked[0].name).toBe("orders-service");
  });

  it("prefers recent work among equally relevant repositories", () => {
    const ranked = rankRepos(
      [
        repo("old-api", { description: "REST API in NodeJS", pushed_at: "2020-01-01T00:00:00Z" }),
        repo("new-api", { description: "REST API in NodeJS", pushed_at: "2026-09-01T00:00:00Z" }),
      ],
      job,
      makeResume(),
      "octocat",
      NOW,
    );
    expect(ranked.map((r) => r.name)).toEqual(["new-api", "old-api"]);
  });

  it("leaves out the profile README, dotfiles and projects the resume already lists", () => {
    const resume = makeResume({
      projects: [{ name: "Orders Service", role: null, description: null, bullets: [], technologies: [] }],
    });
    const ranked = rankRepos(
      [repo("octocat"), repo("dotfiles"), repo(".github"), repo("orders-service"), repo("chat-app")],
      job,
      resume,
      "Octocat",
      NOW,
    );
    expect(ranked.map((r) => r.name)).toEqual(["chat-app"]);
  });

  it("keeps at most the candidates the model reads", () => {
    const repos = Array.from({ length: 20 }, (_, i) => repo(`repo-${i}`));
    expect(rankRepos(repos, job, makeResume(), "octocat", NOW)).toHaveLength(MAX_CANDIDATES);
  });
});

describe("finalizeProposals", () => {
  const project = (repoName: string, overrides: Partial<GithubProjects["projects"][number]> = {}) => ({
    repo: repoName,
    name: "Orders Service",
    description: "Order processing for a shop.",
    technologies: ["TypeScript", "Kubernetes", "typescript"],
    bullets: ["Built order APIs in NodeJS", " ", "Built order APIs in NodeJS"],
    matched_requirements: ["Kubernetes"],
    reason: "Shows Kubernetes.",
    new_skills: ["Kubernetes", "PostgreSQL", "Node.js"],
    ...overrides,
  });
  const candidates = [repo("orders-service"), repo("chat-app"), repo("a"), repo("b"), repo("c")];

  it("keeps projects of repositories the model was given, once each", () => {
    const result = finalizeProposals(
      {
        projects: [project("Orders-Service"), project("orders-service"), project("not-given")],
        skipped: [
          { repo: "chat-app", reason: "Tutorial" },
          { repo: "orders-service", reason: "Picked anyway" },
          { repo: "made-up", reason: "?" },
        ],
      },
      candidates,
      makeResume(),
      "octocat",
    );
    expect(result.proposals.map((p) => p.repo)).toEqual(["orders-service"]);
    expect(result.proposals[0].url).toBe("https://github.com/octocat/orders-service");
    expect(result.skipped).toEqual([{ repo: "chat-app", reason: "Tutorial" }]);
    expect(result.considered).toBe(5);
  });

  it("cleans lists and drops skills the resume already has", () => {
    const [proposal] = finalizeProposals({ projects: [project("chat-app")], skipped: [] }, candidates, makeResume(), "octocat")
      .proposals;
    expect(proposal.technologies).toEqual(["TypeScript", "Kubernetes"]);
    expect(proposal.bullets).toEqual(["Built order APIs in NodeJS"]);
    // The resume lists Node.js and PostgreSQL already.
    expect(proposal.new_skills).toEqual(["Kubernetes"]);
  });

  it("drops projects without bullets and keeps at most 4", () => {
    const result = finalizeProposals(
      {
        projects: [
          project("orders-service", { bullets: [""] }),
          ...["chat-app", "a", "b", "c"].map((name) => project(name)),
          project("orders-service"),
        ],
        skipped: [],
      },
      candidates,
      makeResume(),
      "octocat",
    );
    expect(result.proposals.map((p) => p.repo)).toEqual(["chat-app", "a", "b", "c"]);
  });

  it("turns a proposal into a resume project with the repository link as its role line", () => {
    const [proposal] = finalizeProposals({ projects: [project("chat-app")], skipped: [] }, candidates, makeResume(), "octocat")
      .proposals;
    expect(toResumeProject(proposal)).toEqual({
      name: "Orders Service",
      role: "github.com/octocat/chat-app",
      description: "Order processing for a shop.",
      bullets: ["Built order APIs in NodeJS"],
      technologies: ["TypeScript", "Kubernetes"],
    });
  });
});
