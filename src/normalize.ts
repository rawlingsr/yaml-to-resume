import { contactLinks, isHttpUrl } from "./format";
import type {
  Certification,
  Company,
  ContactInfo,
  DatesWorked,
  Intro,
  Position,
  RawResume,
  Resume,
  School,
  Skill,
} from "./types";

// Shape checks for raw YAML. Each throws an error that names the field, so a typo fails at load time
// (in Next.js, at build time) instead of crashing while a page renders.

function invalid(field: string, value: unknown, expected: string): never {
  throw new Error(`Invalid ${field}: ${JSON.stringify(value)} in resume data. ${expected}`);
}

// Missing or null is an empty list; anything other than a list throws.
function asList(value: unknown, field: string): unknown[] {
  if (value == null) {
    return [];
  }
  if (!Array.isArray(value)) {
    invalid(field, value, "Expected a list.");
  }
  return value;
}

function asMapping(value: unknown, field: string): Record<string, unknown> {
  if (!isPlainObject(value)) {
    invalid(field, value, "Expected key: value pairs.");
  }
  return value;
}

// Text may be written as a string, number, or boolean in YAML (a phone number often parses as a number).
function asText(value: unknown, field: string): string | undefined {
  if (value == null) {
    return undefined;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  invalid(field, value, "Expected text.");
}

// A full http(s) URL, or a bare domain (gets https://). Any other scheme (data:, javascript:, mailto:) throws.
function asUrl(value: unknown, field: string): string | undefined {
  const text = asText(value, field)?.trim();
  if (!text) {
    return undefined;
  }
  const hasOtherScheme = !isHttpUrl(text) && /^[a-z][a-z0-9+.-]*:/i.test(text);
  const href = isHttpUrl(text) ? text : `https://${text}`;
  let parsed: URL | null = null;
  try {
    parsed = hasOtherScheme ? null : new URL(href);
  } catch {
    parsed = null;
  }
  if (!parsed || !parsed.hostname) {
    invalid(field, value, "Expected an http(s) URL or a bare domain like example.com.");
  }
  return href;
}

// How an entry is named in errors: by its name when it has one, otherwise by position.
function entryLabel(kind: string, name: unknown, index: number): string {
  return typeof name === "string" && name.trim() ? `${kind} "${name}"` : `${kind} #${index + 1}`;
}

const DATE_PATTERN = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

// Accepts YYYY, YYYY-MM, or YYYY-MM-DD (as UTC midnight), a bare year written as a YAML number
// (`new Date(2016)` would read it as milliseconds, i.e. 1970), or a Date the YAML parser already made.
// Anything else, including loose strings like "June 2016" that `new Date` would guess at, throws an
// error that names the entry, so bad YAML fails the build instead of rendering a wrong date.
function parseDate(value: unknown, field: string): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  if (typeof value === "number" && Number.isInteger(value) && value >= 1000 && value <= 9999) {
    return new Date(Date.UTC(value, 0, 1));
  }
  const match = typeof value === "string" ? DATE_PATTERN.exec(value.trim()) : null;
  if (match) {
    const year = Number(match[1]);
    const month = match[2] ? Number(match[2]) : 1;
    const day = match[3] ? Number(match[3]) : 1;
    const date = new Date(Date.UTC(year, month - 1, day));
    // Date.UTC rolls 2020-13 into 2021-01 and 2020-02-30 into March; a round trip catches that.
    if (date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day) {
      return date;
    }
  }
  invalid(field, value, "Expected a date like 2023-11 (YYYY, YYYY-MM, or YYYY-MM-DD).");
}

// `[from]` or `[from, null]` means "to Present".
function parseDatesWorked(value: unknown, owner: string): [Date, Date | null] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 2) {
    throw new Error(
      `Invalid dates_worked for ${owner}: ${JSON.stringify(value)} in resume data. ` +
      `Expected [start] or [start, end], e.g. [2016-06, 2023-11].`,
    );
  }
  const [from, to] = value;
  return [
    parseDate(from, `dates_worked start for ${owner}`),
    to == null || to === "" ? null : parseDate(to, `dates_worked end for ${owner}`),
  ];
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);
}

// Objects merge recursively; scalars, arrays, and nulls in `override` replace the base value.
export function deepMerge(base: unknown, override: unknown): unknown {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return override === undefined ? base : override;
  }
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    result[key] = deepMerge(base[key], value);
  }
  return result;
}

export function getSchools({ schools }: { schools?: unknown }): School[] {
  return asList(schools, "schools").map((entry, index) => {
    const school = asMapping(entry, `school #${index + 1}`);
    const owner = entryLabel("school", school.name, index);
    return {
      name: asText(school.name, `name for ${owner}`) ?? "",
      degree: asText(school.degree, `degree for ${owner}`) ?? "",
      description: asText(school.description, `description for ${owner}`) ?? "",
      website: asUrl(school.website, `website for ${owner}`),
      graduation_date: parseDate(school.graduation_date, `graduation_date for ${owner}`),
      still_attending: school.still_attending === true,
    };
  });
}

export function getSkills({ skills }: { skills?: unknown }): Skill[] {
  return asList(skills, "skills").map((entry, index) => {
    const raw = asMapping(entry, `skill group #${index + 1}`);
    const owner = entryLabel("skill group", raw.name, index);
    const skill: Skill = {
      name: asText(raw.name, `name for ${owner}`) ?? "",
      keywords: asList(raw.keywords, `keywords for ${owner}`).map(
        (keyword, i) => asText(keyword, `keyword #${i + 1} for ${owner}`) ?? "",
      ),
    };
    const description = asText(raw.description, `description for ${owner}`);
    if (description !== undefined) {
      skill.description = description;
    }
    return skill;
  });
}


function parseHttpUrl(value: unknown, owner: string): string {
  let url: URL | null = null;
  try {
    url = typeof value === "string" ? new URL(value) : null;
  } catch {
    url = null;
  }
  if (!url || (url.protocol !== "http:" && url.protocol !== "https:")) {
    throw new Error(
      `Invalid url for ${owner}: ${JSON.stringify(value)} in resume data. ` +
      `Expected a full http(s) URL, e.g. https://example.com/verify/123.`,
    );
  }
  return value as string;
}

export function getCertifications({ certifications }: { certifications?: unknown }): Certification[] {
  return asList(certifications, "certifications").map((entry, index) => {
    const raw = asMapping(entry, `certification #${index + 1}`);
    const name = asText(raw.name, `name for certification #${index + 1}`)?.trim();
    if (!name) {
      invalid(`name for certification #${index + 1}`, raw.name, "Every certification needs a name.");
    }
    const owner = `certification "${name}"`;
    // `year` was the field name in 0.2.0; fail loudly rather than silently dropping the date.
    if (raw.year != null) {
      invalid(`year for ${owner}`, raw.year, "`year` was renamed to `date`, e.g. date: 2017 or date: 2017-05-18.");
    }
    const certification: Certification = { name };
    const issuer = asText(raw.issuer, `issuer for ${owner}`);
    if (issuer) {
      certification.issuer = issuer;
    }
    if (raw.date != null && raw.date !== "") {
      certification.date = parseDate(raw.date, `date for ${owner}`);
    }
    if (raw.url != null && raw.url !== "") {
      certification.url = parseHttpUrl(raw.url, owner);
    }
    return certification;
  });
}

export function getCompanies({ companies }: { companies?: unknown }): Company[] {
  const result: Company[] = [];
  asList(companies, "companies").forEach((entry, index) => {
    const raw = asMapping(entry, `company #${index + 1}`);
    // No dates_worked (missing, null, or empty) hides the company on purpose.
    if (raw.dates_worked == null || raw.dates_worked === "") {
      return;
    }
    const owner = entryLabel("company", raw.name, index);
    result.push({
      name: asText(raw.name, `name for ${owner}`) ?? "",
      dates_worked: parseDatesWorked(raw.dates_worked, owner),
      description: asText(raw.description, `description for ${owner}`) ?? "",
      location: asText(raw.location, `location for ${owner}`) ?? "",
      website: asUrl(raw.website, `website for ${owner}`),
      positions: getPositions(raw, owner, index),
    });
  });
  return result;
}

function getPositions(company: Record<string, unknown>, companyLabel: string, companyIndex: number): Position[] {
  // Positions name their company as `at "Acme"`, or `at company #2` when it has no name.
  const companyRef = typeof company.name === "string" && company.name.trim()
    ? `"${company.name}"`
    : `company #${companyIndex + 1}`;
  return asList(company.positions, `positions for ${companyLabel}`).map((entry, index) => {
    const raw = asMapping(entry, `position #${index + 1} at ${companyRef}`);
    const owner = `${entryLabel("position", raw.title, index)} at ${companyRef}`;
    const dates_worked: DatesWorked = raw.dates_worked == null || raw.dates_worked === ""
      ? null
      : parseDatesWorked(raw.dates_worked, owner);
    return {
      title: asText(raw.title, `title for ${owner}`) ?? "",
      dates_worked,
      description: asText(raw.description, `description for ${owner}`) ?? "",
      achievements: asList(raw.achievements, `achievements for ${owner}`).map(
        (achievement, i) => asText(achievement, `achievement #${i + 1} for ${owner}`) ?? "",
      ),
    };
  });
}

export function getContactInfo({ contact_info }: { contact_info?: unknown }): ContactInfo {
  if (contact_info == null) {
    return {};
  }
  const raw = asMapping(contact_info, "contact_info");
  const field = (key: keyof ContactInfo) => asText(raw[key], `contact_info.${key}`);

  const info: ContactInfo = {
    linkedin: field("linkedin"),
    github: field("github"),
    email: field("email"),
    location: field("location"),
    phone: field("phone"),
    website: field("website"),
  };
  // Building the links validates them (e.g. a github value that isn't a GitHub URL), so bad
  // contact info fails when the resume is loaded rather than when a page renders it.
  contactLinks(info);
  return info;
}

function getIntro({ summary, objective }: { summary?: unknown; objective?: unknown }): Intro | null {
  if (summary) {
    return { kind: "summary", text: String(summary) };
  }
  if (objective) {
    return { kind: "objective", text: String(objective) };
  }
  return null;
}

/**
 * Validates raw resume data and converts it into a `Resume`. Throws an error naming the field for
 * malformed dates, lists that aren't lists, mappings where text is expected, and bad URLs.
 */
export function normalizeResume(raw: RawResume): Resume {
  return {
    name: typeof raw.name === "string" ? raw.name : "",
    target_position: typeof raw.target_position === "string" && raw.target_position
      ? raw.target_position
      : undefined,
    intro: getIntro(raw),
    schools: getSchools(raw),
    skills: getSkills(raw),
    certifications: getCertifications(raw),
    companies: getCompanies(raw),
    contact_info: getContactInfo(raw),
  };
}
