import { describe, expect, it } from "vitest";
import { makeJob, makeResume, terms } from "@/test/fixtures";
import { scoreAts } from "./score";

describe("scoreAts", () => {
  it("scores coverage of required, preferred and keyword terms", () => {
    const result = scoreAts(makeResume(), makeJob(), "vn");

    expect(result.coverage.required).toEqual({ matched: ["NodeJS", "PostgreSQL"], missing: ["Kubernetes"] });
    expect(result.components.required).toBe(67);
    expect(result.components.preferred).toBe(100);
    expect(result.coverage.keywords.missing).toEqual(["microservices", "Agile"]);
    expect(result.components.keywords).toBe(50);
    // 4 of 5 required years.
    expect(result.components.experience).toBe(80);
  });

  it("drops components the JD gives nothing to score and re-weights the rest", () => {
    const job = makeJob({ preferred_skills: [], keywords: [], min_years_experience: null });
    const result = scoreAts(makeResume(), job, "vn");

    expect(result.components.preferred).toBeNull();
    expect(result.components.keywords).toBeNull();
    expect(result.components.experience).toBeNull();
    // Only required (67, weight 40) and format (weight 10) remain.
    const format = result.components.format!;
    expect(result.overall).toBe(Math.round((67 * 40 + format * 10) / 50));
  });

  it("deduplicates terms that normalize to the same form", () => {
    const job = makeJob({ required_skills: terms("Node.js", "NodeJS", "node") });
    const result = scoreAts(makeResume(), job, "vn");
    expect(result.coverage.required.matched).toEqual(["Node.js"]);
  });

  it("matches a term through its aliases: translations, inflections and alternatives", () => {
    const job = makeJob({
      required_skills: [
        { term: "Kafka / RabbitMQ", aliases: ["Kafka", "RabbitMQ"] },
        { term: "Unit testing", aliases: ["unit tests", "unit test"] },
      ],
      keywords: [
        { term: "Thương mại điện tử", aliases: ["e-commerce"] },
        { term: "Hướng dẫn junior", aliases: ["mentoring", "mentored"] },
      ],
    });
    const resume = makeResume({
      summary: "Backend engineer for e-commerce platforms.",
      experiences: [
        {
          ...makeResume().experiences[0],
          bullets: ["Wrote unit tests with Jest", "Built consumers on RabbitMQ", "Mentored 3 junior engineers"],
        },
      ],
    });
    const result = scoreAts(resume, job, "vn");

    // Coverage reports the canonical term, whichever variant matched.
    expect(result.coverage.required).toEqual({ matched: ["Kafka / RabbitMQ", "Unit testing"], missing: [] });
    expect(result.coverage.keywords).toEqual({ matched: ["Thương mại điện tử", "Hướng dẫn junior"], missing: [] });
  });

  it("does not match related but different skills", () => {
    const job = makeJob({ required_skills: [{ term: "Kubernetes", aliases: ["K8s"] }] });
    expect(scoreAts(makeResume(), job, "vn").coverage.required.missing).toEqual(["Kubernetes"]);
  });

  it("flags photo and date of birth only for international applications", () => {
    const resume = makeResume({ has_photo: true, has_date_of_birth: true });
    const codes = (market: "vn" | "international") =>
      scoreAts(resume, makeJob(), market).formatIssues.map((issue) => issue.code);

    expect(codes("vn")).not.toContain("photo_international");
    expect(codes("international")).toEqual(expect.arrayContaining(["photo_international", "dob_international"]));
  });

  it("flags missing contact details and low use of metrics", () => {
    const resume = makeResume({
      email: null,
      experiences: [
        {
          ...makeResume().experiences[0],
          bullets: ["Built APIs", "Wrote tests", "Reviewed code", "Fixed bugs"],
        },
      ],
    });
    const codes = scoreAts(resume, makeJob(), "vn").formatIssues.map((issue) => issue.code);
    expect(codes).toEqual(expect.arrayContaining(["missing_email", "low_metrics"]));
  });

  it("gives partial experience credit when years are unknown", () => {
    const result = scoreAts(makeResume({ total_years_experience: null }), makeJob(), "vn");
    expect(result.components.experience).toBe(50);
  });
});
