import { describe, expect, it } from "vitest";
import { normalizeResume } from "../src/index";

describe("normalizeResume", () => {
  it("prefers summary over objective", () => {
    expect(normalizeResume({ summary: "S", objective: "O" }).intro).toEqual({ kind: "summary", text: "S" });
  });

  it("falls back to objective, then null", () => {
    expect(normalizeResume({ objective: "O" }).intro).toEqual({ kind: "objective", text: "O" });
    expect(normalizeResume({}).intro).toBeNull();
    expect(normalizeResume({ summary: "" }).intro).toBeNull();
  });

  it("fills in empty defaults for a minimal resume", () => {
    expect(normalizeResume({ name: "A" })).toEqual({
      name: "A",
      target_position: undefined,
      intro: null,
      schools: [],
      skills: [],
      certifications: [],
      companies: [],
      contact_info: {},
    });
  });

  it("drops an empty target_position", () => {
    expect(normalizeResume({ name: "A", target_position: "" }).target_position).toBeUndefined();
    expect(normalizeResume({ name: "A", target_position: "Dev" }).target_position).toBe("Dev");
  });

  it("runs the getters (hiding companies, converting dates)", () => {
    const resume = normalizeResume({
      companies: [
        { name: "Shown", dates_worked: ["2020-01"] },
        { name: "Hidden" },
      ],
      schools: [{ name: "U", graduation_date: "2015-05" }],
    });
    expect(resume.companies.map((c) => c.name)).toEqual(["Shown"]);
    expect(resume.schools[0].graduation_date).toBeInstanceOf(Date);
  });

  it("throws for a malformed date", () => {
    expect(() => normalizeResume({ companies: [{ name: "Acme", dates_worked: ["2020-13"] }] })).toThrow(
      /company "Acme"/,
    );
  });
});

describe("certifications", () => {
  const certs = (certifications: unknown) => normalizeResume({ certifications }).certifications;

  it("is empty when missing or null", () => {
    expect(certs(undefined)).toEqual([]);
    expect(certs(null)).toEqual([]);
  });

  it("keeps name, issuer, year, and url, and drops empty optional fields", () => {
    expect(
      certs([
        { name: "CTFL", issuer: "ASTQB", year: 2017, url: "https://example.org/verify" },
        { name: "Linux Essentials", issuer: "", year: "2025", url: null },
      ]),
    ).toEqual([
      { name: "CTFL", issuer: "ASTQB", year: 2017, url: "https://example.org/verify" },
      { name: "Linux Essentials", year: 2025 },
    ]);
  });

  it("throws for a list that isn't a list", () => {
    expect(() => certs({ name: "CTFL" })).toThrow(/Invalid certifications/);
  });

  it("throws for a missing or blank name, naming the entry by position", () => {
    expect(() => certs([{ name: "A" }, { issuer: "ASTQB" }])).toThrow(/certification #2/);
    expect(() => certs(["CTFL"])).toThrow(/certification #1/);
    expect(() => certs([{ name: "  " }])).toThrow(/certification #1/);
  });

  it("accepts only four-digit years", () => {
    for (const year of ["2017-05", 17, 20170, "soon", 2017.5]) {
      expect(() => certs([{ name: "CTFL", year }])).toThrow(/Invalid year for certification "CTFL"/);
    }
  });

  it("accepts only full http(s) urls", () => {
    for (const url of ["example.org/verify", "javascript:alert(1)", "data:text/html,hi", 42]) {
      expect(() => certs([{ name: "CTFL", url }])).toThrow(/Invalid url for certification "CTFL"/);
    }
    expect(certs([{ name: "CTFL", url: "http://example.org" }])[0].url).toBe("http://example.org");
  });
});

describe("shape validation", () => {
  const company = (extra: Record<string, unknown>) => ({ name: "Acme", dates_worked: ["2020-01"], ...extra });

  it("throws for sections that aren't lists, naming the field", () => {
    expect(() => normalizeResume({ schools: { name: "U" } })).toThrow(/Invalid schools: .* Expected a list/);
    expect(() => normalizeResume({ skills: "TypeScript" })).toThrow(/Invalid skills/);
    // A string used to be iterated character by character and silently dropped.
    expect(() => normalizeResume({ companies: "hello" })).toThrow(/Invalid companies/);
  });

  it("throws for entries that aren't key: value pairs", () => {
    expect(() => normalizeResume({ schools: ["U"] })).toThrow(/school #1/);
    expect(() => normalizeResume({ companies: [company({ positions: ["Engineer"] })] })).toThrow(
      /position #1 at "Acme"/,
    );
  });

  it("throws at load time for achievements or keywords written as a single string", () => {
    expect(() =>
      normalizeResume({ companies: [company({ positions: [{ title: "Dev", achievements: "did stuff" }] })] }),
    ).toThrow(/achievements for position "Dev" at "Acme"/);
    expect(() => normalizeResume({ skills: [{ name: "Langs", keywords: "TypeScript" }] })).toThrow(
      /keywords for skill group "Langs"/,
    );
  });

  it("throws for a mapping where text is expected", () => {
    expect(() => normalizeResume({ contact_info: { email: { a: 1 } } })).toThrow(/contact_info\.email/);
    expect(() => normalizeResume({ companies: [company({ description: ["a", "b"] })] })).toThrow(
      /description for company "Acme"/,
    );
    expect(() => normalizeResume({ contact_info: ["github: x"] })).toThrow(/Invalid contact_info/);
  });

  it("turns numbers and booleans into text, e.g. a phone number", () => {
    const resume = normalizeResume({
      contact_info: { phone: 5555550100 },
      skills: [{ name: "Years", keywords: [2020, true] }],
    });
    expect(resume.contact_info.phone).toBe("5555550100");
    expect(resume.skills[0].keywords).toEqual(["2020", "true"]);
  });

  it("keeps http(s) websites, adds https:// to a bare domain, and rejects other schemes", () => {
    const resume = normalizeResume({
      companies: [
        company({ website: "https://acme.example/jobs" }),
        company({ name: "Beta", website: "beta.example" }),
        company({ name: "Gamma" }),
      ],
      schools: [{ name: "U", graduation_date: "2015-05", website: "http://u.example" }],
    });
    expect(resume.companies.map((c) => c.website)).toEqual([
      "https://acme.example/jobs",
      "https://beta.example",
      undefined,
    ]);
    expect(resume.schools[0].website).toBe("http://u.example");

    for (const website of ["data:text/html,hi", "javascript:alert(1)", "mailto:a@b.example", "https://"]) {
      expect(() => normalizeResume({ companies: [company({ website })] })).toThrow(/website for company "Acme"/);
    }
    expect(() => normalizeResume({ schools: [{ name: "U", graduation_date: "2015-05", website: "data:x" }] }))
      .toThrow(/website for school "U"/);
  });

  it("treats still_attending as true only when it's really true", () => {
    const schools = normalizeResume({
      schools: [
        { name: "A", graduation_date: "2015-05", still_attending: true },
        { name: "B", graduation_date: "2015-05", still_attending: "false" },
      ],
    }).schools;
    expect(schools.map((s) => s.still_attending)).toEqual([true, false]);
  });

  it("names unnamed entries by position", () => {
    expect(() => normalizeResume({ companies: [company({}), { dates_worked: ["2020-13"] }] })).toThrow(
      /company #2/,
    );
  });
});

describe("dates", () => {
  const start = (from: unknown) =>
    normalizeResume({ companies: [{ name: "Acme", dates_worked: [from] }] }).companies[0].dates_worked?.[0];

  it("reads a bare year as January 1 of that year, not as milliseconds", () => {
    expect(start(2016)?.toISOString()).toBe("2016-01-01T00:00:00.000Z");
    expect(start("2016")?.toISOString()).toBe("2016-01-01T00:00:00.000Z");
  });

  it("accepts YYYY-MM and YYYY-MM-DD as UTC dates", () => {
    expect(start("2021-03")?.toISOString()).toBe("2021-03-01T00:00:00.000Z");
    expect(start("2021-03-15")?.toISOString()).toBe("2021-03-15T00:00:00.000Z");
  });

  it("accepts a Date the YAML parser already made", () => {
    const date = new Date(Date.UTC(2019, 5, 1));
    expect(start(date)).toBe(date);
  });

  it("rejects loose or impossible dates instead of guessing", () => {
    for (const from of ["1", "June 2016", "2020-13", "2020-02-30", "2020-1", 16, 2016.5, 20160, true, {}]) {
      expect(() => start(from)).toThrow(/Invalid dates_worked start for company "Acme"/);
    }
  });

  it("applies the same rules to graduation_date", () => {
    expect(() => normalizeResume({ schools: [{ name: "U", graduation_date: "May 2015" }] })).toThrow(
      /graduation_date for school "U"/,
    );
    expect(
      normalizeResume({ schools: [{ name: "U", graduation_date: 2015 }] }).schools[0].graduation_date.toISOString(),
    ).toBe("2015-01-01T00:00:00.000Z");
  });
});
