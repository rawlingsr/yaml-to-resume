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
