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

/**
 * A piece of CV text. `key` names its place in the layout and doesn't change between
 * renders of the same analysis, so the user's hand edits are stored against it.
 */
export interface CvText {
  key: string;
  /** Empty when the resume has no such field or the user cleared it. */
  text: string;
  /** Rewritten by a suggestion the user accepted. */
  changed: boolean;
  /** Edited by hand on the preview page. */
  edited: boolean;
}

export interface CvEntry {
  title: CvText;
  subtitle: CvText;
  dates: CvText;
  paragraphs: CvText[];
  bullets: CvText[];
}

export interface CvSection {
  key: string;
  heading: string;
  entries: CvEntry[];
}

/** A renderer-neutral layout of the CV, shared by the preview, PDF and DOCX. */
export interface CvDocument {
  language: CvLanguage;
  name: CvText;
  headline: CvText;
  contact: CvText[];
  sections: CvSection[];
}

/** A hand edit. It applies only while the CV still shows `base`, so a later change of suggestion wins. */
export interface CvEdit {
  base: string;
  value: string;
}

export type CvEdits = Record<string, CvEdit>;

export const MAX_CV_TEXT = 5000;

/** Keys are dot-separated lowercase words and numbers, e.g. "experience.0.b.2". */
export const CV_KEY_PATTERN = /^[a-z]+(\.[a-z0-9]+){0,4}$/;

function piece(key: string, text: string | null, changed = false): CvText {
  return { key, text: text ?? "", changed, edited: false };
}

function joined(parts: (string | null)[], separator: string): string | null {
  return parts.filter(Boolean).join(separator) || null;
}

function lines(text: string | null): string[] {
  return (text ?? "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

interface EntryFields {
  title?: string | null;
  subtitle?: string | null;
  dates?: string | null;
  paragraphs?: string[];
  bullets?: string[];
  paragraphsChanged?: boolean;
  bulletChanged?: (index: number) => boolean;
}

function entry(key: string, fields: EntryFields): CvEntry {
  return {
    title: piece(`${key}.title`, fields.title ?? null),
    subtitle: piece(`${key}.subtitle`, fields.subtitle ?? null),
    dates: piece(`${key}.dates`, fields.dates ?? null),
    paragraphs: (fields.paragraphs ?? []).map((text, i) => piece(`${key}.p.${i}`, text, fields.paragraphsChanged)),
    bullets: (fields.bullets ?? []).map((text, i) => piece(`${key}.b.${i}`, text, fields.bulletChanged?.(i))),
  };
}

export function buildCvDocument({ resume, changed }: Revision): CvDocument {
  const language: CvLanguage = resume.detected_language === "vi" ? "vi" : "en";
  const labels = LABELS[language];
  const sections: CvSection[] = [];
  const add = (key: string, heading: string, entries: CvEntry[]) => {
    if (entries.length > 0) sections.push({ key, heading, entries });
  };

  if (resume.summary) {
    add("summary", labels.summary, [
      entry("summary.0", { paragraphs: lines(resume.summary), paragraphsChanged: changed.has(SUMMARY_LINE) }),
    ]);
  }

  add(
    "experience",
    labels.experience,
    resume.experiences.map((job, item) =>
      entry(`experience.${item}`, {
        title: job.title,
        subtitle: joined([job.company, job.location], ", "),
        dates: joined([job.start_date, job.end_date ?? (job.is_current ? labels.present : null)], " – "),
        bullets: job.bullets,
        bulletChanged: (bullet) => changed.has(lineKey("experience", item, bullet)),
      }),
    ),
  );

  add(
    "projects",
    labels.projects,
    resume.projects.map((project, item) =>
      entry(`projects.${item}`, {
        title: project.name,
        subtitle: project.role,
        paragraphs: [
          ...lines(project.description),
          ...(project.technologies.length > 0 ? [`${labels.technologies}: ${project.technologies.join(", ")}`] : []),
        ],
        bullets: project.bullets,
        bulletChanged: (bullet) => changed.has(lineKey("project", item, bullet)),
      }),
    ),
  );

  add(
    "education",
    labels.education,
    resume.education.map((school, item) =>
      entry(`education.${item}`, {
        title: school.school,
        subtitle: joined([school.degree, school.field], ", "),
        dates: joined([school.start_date, school.end_date], " – "),
        paragraphs: school.gpa ? [`GPA: ${school.gpa}`] : [],
      }),
    ),
  );

  if (resume.skills.length > 0) add("skills", labels.skills, [entry("skills.0", { paragraphs: [resume.skills.join(", ")] })]);
  if (resume.certifications.length > 0) {
    add("certifications", labels.certifications, [entry("certifications.0", { bullets: resume.certifications })]);
  }
  if (resume.languages.length > 0) {
    const spoken = resume.languages.map((l) => (l.proficiency ? `${l.language} (${l.proficiency})` : l.language));
    add("languages", labels.languages, [entry("languages.0", { paragraphs: [spoken.join(", ")] })]);
  }
  resume.other_sections.forEach((other, i) =>
    add(`other.${i}`, other.title, [entry(`other.${i}.0`, { paragraphs: lines(other.content) })]),
  );

  const links = resume.links.map((link) => link.url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""));
  return {
    language,
    name: piece("name", resume.full_name),
    headline: piece("headline", resume.headline),
    contact: [
      piece("contact.email", resume.email),
      piece("contact.phone", resume.phone),
      piece("contact.location", resume.location),
      ...links.map((url, i) => piece(`contact.link.${i}`, url)),
    ],
    sections,
  };
}

/** Every piece of text in the document, in reading order. */
export function cvTexts(doc: CvDocument): CvText[] {
  return [
    doc.name,
    doc.headline,
    ...doc.contact,
    ...doc.sections.flatMap((section) =>
      section.entries.flatMap((e) => [e.title, e.subtitle, e.dates, ...e.paragraphs, ...e.bullets]),
    ),
  ];
}

function mapTexts(doc: CvDocument, map: (text: CvText) => CvText): CvDocument {
  return {
    ...doc,
    name: map(doc.name),
    headline: map(doc.headline),
    contact: doc.contact.map(map),
    sections: doc.sections.map((section) => ({
      ...section,
      entries: section.entries.map((e) => ({
        title: map(e.title),
        subtitle: map(e.subtitle),
        dates: map(e.dates),
        paragraphs: e.paragraphs.map(map),
        bullets: e.bullets.map(map),
      })),
    })),
  };
}

export function applyCvEdits(doc: CvDocument, edits: CvEdits): CvDocument {
  return mapTexts(doc, (text) => {
    const edit = edits[text.key];
    return edit && edit.base === text.text ? { ...text, text: edit.value, edited: true } : text;
  });
}

/** The document as exported: blank lines, entries and sections left out. */
export function pruneEmpty(doc: CvDocument): CvDocument {
  const filled = (texts: CvText[]) => texts.filter((text) => text.text.trim() !== "");
  const sections = doc.sections
    .map((section) => ({
      ...section,
      entries: section.entries
        .map((e) => ({ ...e, paragraphs: filled(e.paragraphs), bullets: filled(e.bullets) }))
        .filter((e) => filled([e.title, e.subtitle, e.dates, ...e.paragraphs, ...e.bullets]).length > 0),
    }))
    .filter((section) => section.entries.length > 0);
  return { ...doc, contact: filled(doc.contact), sections };
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
