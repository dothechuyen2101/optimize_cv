import { describe, expect, it } from "vitest";
import { makeResume } from "@/test/fixtures";
import { groundResume } from "./ground";

// Shaped like a real PDF text layer: wrapped lines, icons, bullet dashes.
const SOURCE = `Nguyễn Văn Bình
Software Engineer
 0912345678
✉ binh.nguyen@example.com
WORK EXPERIENCE
Digital banking development
center - ABC Bank
06/2024 - 07/2026
FULLSTACK DEVELOPER
Springboot, Angular, Oracle, Redis, Kafka, Docker, SQL Stored Procedures, CI/CD,
OpenShift, Agile
FTech
01/2023 - 06/2025
- Typescript, Javascript, Python, Postgres, Mongo, Redis
EDUCATION
Hanoi University of Science and Technology
09/2018 - 09/2023
GPA: 3.33`;

function resumeWith(overrides: Parameters<typeof makeResume>[0]) {
  return makeResume({ links: [], languages: [], skills: [], education: [], ...overrides });
}

describe("groundResume", () => {
  it("restores misread digits, diacritics and words from the source text", () => {
    const resume = resumeWith({
      full_name: "Nguyễn Văn Bính",
      phone: "0921345678",
      email: "binh.nguyen@example.com",
      skills: ["Postgresg", "Redis"],
      experiences: [
        {
          title: "FULLSTACK DEVELOPER",
          company: "Digital banking development center - ABC Bank",
          location: null,
          start_date: "06/2024",
          end_date: "07/2026",
          is_current: false,
          bullets: ["Springboot, Angular, Oracle, Redis, Kafka, Docker, SQL Stored Procedures, O/C, OpenShift, Agile"],
        },
      ],
      education: [
        { school: "Hanoi University of Science and Technology", degree: null, field: null, start_date: "09/2008", end_date: "09/2023", gpa: "3.33" },
      ],
    });
    const { resume: grounded, corrected } = groundResume(resume, SOURCE);

    expect(grounded.full_name).toBe("Nguyễn Văn Bình");
    expect(grounded.phone).toBe("0912345678");
    expect(grounded.education[0].start_date).toBe("09/2018");
    expect(grounded.skills).toEqual(["Postgres", "Redis"]);
    expect(grounded.experiences[0].bullets[0]).toBe(
      "Springboot, Angular, Oracle, Redis, Kafka, Docker, SQL Stored Procedures, CI/CD, OpenShift, Agile",
    );
    expect(corrected).toBe(5);
    // Exact fields, including ones the source wraps across lines, are left alone.
    expect(grounded.experiences[0].company).toBe("Digital banking development center - ABC Bank");
    expect(grounded.email).toBe("binh.nguyen@example.com");
  });

  it("trusts the model's reading where the source couldn't decode a ligature", () => {
    const resume = resumeWith({ summary: "App backoffice for inside member and microservice for SMB." });
    const source = "App backo�ce for inside member and microservice for SMB.";

    expect(groundResume(resume, source).resume.summary).toBe("App backoffice for inside member and microservice for SMB.");
  });

  it("keeps fields that are ambiguous, too different, too short or not copied", () => {
    const resume = resumeWith({
      full_name: "Nguyễn Văn Bình",
      email: null,
      phone: null,
      location: "Hà Nội",
      headline: "Go",
      links: [{ label: "LinkedIn", url: "linkedin.com/in/binh" }],
      // "06/2026" is one edit away from both "06/2024" and "06/2025".
      experiences: [{ title: "Dev", company: "FTech", location: null, start_date: "06/2026", end_date: null, is_current: true, bullets: [] }],
      detected_language: "en",
    });
    const { resume: grounded, corrected } = groundResume(resume, SOURCE);

    expect(grounded).toEqual(resume);
    expect(corrected).toBe(0);
  });
});
