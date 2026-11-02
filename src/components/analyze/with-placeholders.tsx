import { splitPlaceholders } from "@/lib/analysis/types";

/** Text with its "[X%]"-style gaps highlighted. */
export function WithPlaceholders({ text, className = "bg-warning-soft text-warning" }: { text: string; className?: string }) {
  return splitPlaceholders(text).map((part, index) =>
    index % 2 === 1 ? (
      <mark key={index} className={`rounded px-0.5 ${className}`}>
        {part}
      </mark>
    ) : (
      part
    ),
  );
}
