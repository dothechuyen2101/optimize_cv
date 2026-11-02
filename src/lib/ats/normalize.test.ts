import { describe, expect, it } from "vitest";
import { containsTerm, normalizeText } from "./normalize";

describe("normalizeText", () => {
  it("strips Vietnamese diacritics including đ", () => {
    expect(normalizeText("Quản lý dự án Đà Nẵng")).toBe(" quan ly du an da nang ");
  });

  it("keeps tech punctuation and folds .js / .net spellings", () => {
    expect(normalizeText("C++, C#, ASP.NET, Node.js")).toBe(" c++ c# asp dotnet nodejs ");
  });

  it("maps aliases onto one canonical form", () => {
    expect(normalizeText("ReactJS")).toBe(normalizeText("React"));
    expect(normalizeText("React JS")).toBe(" react ");
    expect(normalizeText("K8s and Postgres")).toBe(" kubernetes and postgresql ");
    expect(normalizeText("CI/CD")).toBe(" cicd ");
  });
});

describe("containsTerm", () => {
  const corpus = normalizeText("Built REST APIs with Node.js and PostgreSQL. Quản lý dự án Agile.");

  it("matches across spellings, accents and aliases", () => {
    expect(containsTerm(corpus, "NodeJS")).toBe(true);
    expect(containsTerm(corpus, "Postgres")).toBe(true);
    expect(containsTerm(corpus, "RESTful API")).toBe(true);
    expect(containsTerm(corpus, "quan ly du an")).toBe(true);
  });

  it("matches the singular and plural of the last word", () => {
    const reviews = normalizeText("Participated in code reviews and wrote unit tests");
    expect(containsTerm(reviews, "Code review")).toBe(true);
    expect(containsTerm(reviews, "Unit test")).toBe(true);
    expect(containsTerm(normalizeText("Built a REST API"), "REST APIs")).toBe(true);
    // "ss" endings are left alone rather than mangled.
    expect(containsTerm(normalizeText("Business analysis"), "Busines")).toBe(false);
  });

  it("only matches whole words", () => {
    expect(containsTerm(corpus, "Java")).toBe(false);
    expect(containsTerm(corpus, "SQL")).toBe(false);
  });

  it("never matches an empty term", () => {
    expect(containsTerm(corpus, " ,. ")).toBe(false);
  });
});
