import { describe, expect, it } from "vitest";
import type { BulletSuggestion } from "@/lib/ai/schemas/analysis";
import type { Choices } from "@/lib/analysis/types";
import { makeAnalysis, makeResume } from "@/test/fixtures";
import { SUMMARY_LINE, lineKey, reviseResume } from "./revise";

function suggestion(overrides: Partial<BulletSuggestion>): BulletSuggestion {
  return {
    section: "experience",
    item_index: 0,
    bullet_index: 0,
    original: "Built REST APIs in Node.js serving 2M requests/day",
    proposed: "Designed REST APIs in Node.js and TypeScript serving 2M requests/day",
    reason: "",
    keywords_added: [],
    needs_user_confirmation: false,
    confirmation_question: null,
    ...overrides,
  };
}

const accepted = { decision: "accepted", text: null } as const;
const choices = (bullets: Choices["bullets"], summary: Choices["summary"] = null): Choices => ({ bullets, summary });

describe("reviseResume", () => {
  const resume = makeResume();

  it("rewrites only accepted lines and leaves the original resume untouched", () => {
    const analysis = makeAnalysis({
      bullet_suggestions: [
        suggestion({}),
        suggestion({ bullet_index: 1, original: "Cut PostgreSQL query time by 40%", proposed: "Rejected rewrite" }),
        suggestion({ bullet_index: 2, original: "Set up CI/CD pipelines on GitHub Actions", proposed: "Undecided rewrite" }),
      ],
    });
    const revision = reviseResume(resume, analysis, choices({ 0: accepted, 1: { decision: "rejected", text: null } }));

    expect(revision.resume.experiences[0].bullets).toEqual([
      "Designed REST APIs in Node.js and TypeScript serving 2M requests/day",
      "Cut PostgreSQL query time by 40%",
      "Set up CI/CD pipelines on GitHub Actions",
      "Mentored 3 junior engineers",
    ]);
    expect([...revision.changed]).toEqual([lineKey("experience", 0, 0)]);
    expect(resume.experiences[0].bullets[0]).toBe("Built REST APIs in Node.js serving 2M requests/day");
  });

  it("uses the user's own wording when they edited the suggestion", () => {
    const analysis = makeAnalysis({ bullet_suggestions: [suggestion({ proposed: "Cut latency by [X%]" })] });
    const revision = reviseResume(resume, analysis, choices({ 0: { decision: "accepted", text: "Cut latency by 35%" } }));

    expect(revision.resume.experiences[0].bullets[0]).toBe("Cut latency by 35%");
  });

  it("finds the line by its text when the model's indexes are off", () => {
    const analysis = makeAnalysis({
      bullet_suggestions: [suggestion({ item_index: 3, bullet_index: 9, original: "• mentored 3  junior engineers" })],
    });
    const revision = reviseResume(resume, analysis, choices({ 0: accepted }));

    expect(revision.resume.experiences[0].bullets[3]).toBe(suggestion({}).proposed);
    expect(revision.changed.has(lineKey("experience", 0, 3))).toBe(true);
    expect(revision.unplaced).toEqual([]);
  });

  it("skips suggestions whose line isn't in the resume or was already rewritten", () => {
    const analysis = makeAnalysis({
      bullet_suggestions: [suggestion({}), suggestion({ proposed: "Second rewrite of the same line" }), suggestion({ original: "Not in the CV" })],
    });
    const revision = reviseResume(resume, analysis, choices({ 0: accepted, 1: accepted, 2: accepted }));

    expect(revision.resume.experiences[0].bullets[0]).toBe(suggestion({}).proposed);
    expect(revision.unplaced).toEqual([1, 2]);
  });

  it("replaces the summary only when the rewrite is accepted", () => {
    const analysis = makeAnalysis();
    expect(reviseResume(resume, analysis, choices({})).resume.summary).toBe(resume.summary);
    expect(reviseResume(resume, analysis, choices({}, { decision: "rejected", text: null })).resume.summary).toBe(resume.summary);

    const revision = reviseResume(resume, analysis, choices({}, accepted));
    expect(revision.resume.summary).toBe(analysis.summary_rewrite.proposed);
    expect(revision.changed.has(SUMMARY_LINE)).toBe(true);

    const noSummary = makeResume({ summary: null });
    expect(reviseResume(noSummary, analysis, choices({}, { decision: "accepted", text: "Mine" })).resume.summary).toBe("Mine");
  });

  it("puts accepted GitHub projects first and adds their new skills once", () => {
    const own = { name: "Wallet", role: null, description: null, bullets: ["Built the wallet API"], technologies: [] };
    const fromGithub = (name: string) => ({ name, role: `github.com/a/${name}`, description: null, bullets: ["Built it"], technologies: [] });
    const analysis = makeAnalysis({
      bullet_suggestions: [suggestion({ section: "project", original: "Built the wallet API", proposed: "Built the wallet API in Go" })],
    });
    const revision = reviseResume(makeResume({ projects: [own] }), analysis, choices({ 0: accepted }), [
      { index: 2, project: fromGithub("orders"), skills: ["Kubernetes", "TypeScript"] },
      { index: 0, project: fromGithub("chat"), skills: ["kubernetes", "Kafka"] },
    ]);

    expect(revision.resume.projects.map((p) => p.name)).toEqual(["orders", "chat", "Wallet"]);
    // The suggestion's position refers to the resume's own project.
    expect(revision.resume.projects[2].bullets).toEqual(["Built the wallet API in Go"]);
    expect(revision.changed.has(lineKey("project", 0, 0))).toBe(true);
    expect(revision.githubProjects).toEqual([2, 0]);
    // TypeScript is already listed; Kubernetes comes once.
    expect(revision.addedSkills).toEqual(["Kubernetes", "Kafka"]);
    expect(revision.resume.skills).toEqual(["Node.js", "TypeScript", "PostgreSQL", "Docker", "Kubernetes", "Kafka"]);
  });
});
