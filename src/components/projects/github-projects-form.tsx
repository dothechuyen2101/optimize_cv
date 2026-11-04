"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/types";
import { parseGithubTarget } from "@/lib/portfolio/github-target";
import { projectsError, type ProjectsErrorCode } from "@/lib/projects/types";

interface Props {
  analysisId: string;
  locale: Locale;
  /** The link of an earlier, failed attempt. */
  initialSource?: string;
  dict: Dictionary["projects"];
  errors: Dictionary["analyze"]["errors"];
}

/** Writes the projects from the user's GitHub, then reloads the page to show them. */
export function GithubProjectsForm({ analysisId, locale, initialSource = "", dict, errors }: Props) {
  const router = useRouter();
  const [github, setGithub] = useState(initialSource);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<ProjectsErrorCode | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!parseGithubTarget(github)) return setError("invalid_github");
    setError(null);
    setRunning(true);
    try {
      const response = await fetch(`/api/analyses/${analysisId}/projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ github, lang: locale }),
      });
      const body = (await response.json().catch(() => null)) as { code?: ProjectsErrorCode } | null;
      // 409: another request is writing them; showing the page again reports that.
      if (response.ok || response.status === 409) {
        router.refresh();
        return;
      }
      setError(body?.code ?? "server");
    } catch {
      setError("server");
    }
    setRunning(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-3">
      <label className="grid gap-1.5">
        <span className="text-sm font-medium">{dict.github}</span>
        <input
          value={github}
          onChange={(event) => setGithub(event.target.value)}
          disabled={running}
          placeholder={dict.githubPlaceholder}
          autoComplete="url"
          className="rounded-lg border border-line bg-card px-3 py-2 text-sm"
        />
        <span className="text-xs text-subtle">{dict.githubHint}</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={running || !github.trim()}
          className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-fg hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {dict.generate}
        </button>
        <span className="text-sm text-subtle" aria-live="polite">
          {running ? dict.generating : dict.generateNote}
        </span>
      </div>
      {error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-4 py-3 text-sm text-danger">
          {projectsError(error, dict.errors, errors)}
        </p>
      )}
    </form>
  );
}
