import { SUMMARY_LINE, lineKey, type Revision } from "./revise";

export type CvLanguage = "vi" | "en";

// Headings follow the resume's language, not the UI's.
const LABELS = {
  vi: {
    summary: "Tóm tắt",
    experience: "Kinh nghiệm làm việc",
    projects: "Dự án",
    education: "Học vấn",
    skills: "Kỹ năng",
    certifications: "Chứng chỉ",
    languages: "Ngoại ngữ",
    technologies: "Công nghệ",
    present: "Hiện tại",
  },
  en: {
    summary: "Summary",
    experience: "Experience",
    projects: "Projects",
    education: "Education",
    skills: "Skills",
    certifications: "Certifications",
    languages: "Languages",
    technologies: "Technologies",
    present: "Present",
  },
} satisfies Record<CvLanguage, Record<string, string>>;

/** A line of CV text; `changed` marks the user's accepted rewrites. */
export interface CvLine {
  text: string;
  changed: boolean;
}

export interface CvEntry {
  title: string | null;
  subtitle: string | null;
  dates: string | null;
  paragraphs: CvLine[];
  bullets: CvLine[];
}

export interface CvSection {
  heading: string;
  entries: CvEntry[];
}

/** A renderer-neutral layout of the CV, shared by the preview, PDF and DOCX. */
export interface CvDocument {
  language: CvLanguage;
  name: string | null;
  headline: string | null;
  contact: string[];
  sections: CvSection[];
}

const line = (text: string, changed = false): CvLine => ({ text, changed });

function entry(fields: Partial<CvEntry>): CvEntry {
  return { title: null, subtitle: null, dates: null, paragraphs: [], bullets: [], ...fields };
}

function joined(parts: (string | null)[], separator: string): string | null {
  return parts.filter(Boolean).join(separator) || null;
}

function paragraphs(text: string, changed = false): CvLine[] {
  return text
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => line(part, changed));
}

export function buildCvDocument({ resume, changed }: Revision): CvDocument {
  const language: CvLanguage = resume.detected_language === "vi" ? "vi" : "en";
  const labels = LABELS[language];
  const sections: CvSection[] = [];
  const add = (heading: string, entries: CvEntry[]) => {
    if (entries.length > 0) sections.push({ heading, entries });
  };

  if (resume.summary) add(labels.summary, [entry({ paragraphs: paragraphs(resume.summary, changed.has(SUMMARY_LINE)) })]);

  add(
    labels.experience,
    resume.experiences.map((job, item) =>
      entry({
        title: job.title,
        subtitle: joined([job.company, job.location], ", "),
        dates: joined([job.start_date, job.end_date ?? (job.is_current ? labels.present : null)], " – "),
        bullets: job.bullets.map((text, bullet) => line(text, changed.has(lineKey("experience", item, bullet)))),
      }),
    ),
  );

  add(
    labels.projects,
    resume.projects.map((project, item) =>
      entry({
        title: project.name,
        subtitle: project.role,
        paragraphs: [
          ...paragraphs(project.description ?? ""),
          ...(project.technologies.length > 0 ? [line(`${labels.technologies}: ${project.technologies.join(", ")}`)] : []),
        ],
        bullets: project.bullets.map((text, bullet) => line(text, changed.has(lineKey("project", item, bullet)))),
      }),
    ),
  );

  add(
    labels.education,
    resume.education.map((school) =>
      entry({
        title: school.school,
        subtitle: joined([school.degree, school.field], ", "),
        dates: joined([school.start_date, school.end_date], " – "),
        paragraphs: school.gpa ? [line(`GPA: ${school.gpa}`)] : [],
      }),
    ),
  );

  if (resume.skills.length > 0) add(labels.skills, [entry({ paragraphs: [line(resume.skills.join(", "))] })]);
  if (resume.certifications.length > 0) {
    add(labels.certifications, [entry({ bullets: resume.certifications.map((c) => line(c)) })]);
  }
  if (resume.languages.length > 0) {
    const spoken = resume.languages.map((l) => (l.proficiency ? `${l.language} (${l.proficiency})` : l.language));
    add(labels.languages, [entry({ paragraphs: [line(spoken.join(", "))] })]);
  }
  for (const other of resume.other_sections) add(other.title, [entry({ paragraphs: paragraphs(other.content) })]);

  const links = resume.links.map((link) => link.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""));
  return {
    language,
    name: resume.full_name,
    headline: resume.headline,
    contact: [resume.email, resume.phone, resume.location, ...links].filter((part): part is string => Boolean(part)),
    sections,
  };
}

function ascii(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** e.g. "CV-Nguyen-Van-A-Senior-Backend-Engineer.pdf" */
export function cvFileName(name: string | null, jobTitle: string | null, extension: "pdf" | "docx"): string {
  const parts = ["CV", name, jobTitle].map((part) => (part ? ascii(part) : "")).filter(Boolean);
  return `${parts.join("-")}.${extension}`;
}
