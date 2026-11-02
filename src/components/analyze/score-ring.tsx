export function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= 75) return "success";
  if (score >= 50) return "warning";
  return "danger";
}

const STROKE = { success: "var(--success)", warning: "var(--warning)", danger: "var(--danger)" };

export function ScoreRing({ score, label }: { score: number; label: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - score / 100);

  return (
    <div className="relative size-36 shrink-0" role="img" aria-label={`${label}: ${score}/100`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--line)" strokeWidth="10" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke={STROKE[scoreTone(score)]}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-semibold tabular-nums">{score}</span>
        <span className="text-xs text-subtle">{label}</span>
      </div>
    </div>
  );
}
