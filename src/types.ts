export interface School {
  name: string;
  degree: string;
  description: string;
  /** Always an http(s) URL; a bare domain in the YAML gets https:// added. */
  website?: string;
  graduation_date: Date;
  still_attending: boolean;
}

export interface Skill {
  name: string;
  keywords: string[]
  description?: string;
}

export interface Certification {
  name: string;
  issuer?: string;
  /** When it was earned (YYYY, YYYY-MM, or YYYY-MM-DD in the YAML). `<Certifications>` shows only the year. */
  date?: Date;
  /** A verification page; when set, the name links to it. Always http(s). */
  url?: string;
}

export interface Company {
  name: string;
  dates_worked?: DatesWorked;
  description: string;
  location: string;
  /** Always an http(s) URL; a bare domain in the YAML gets https:// added. */
  website?: string;
  positions: Position[];
}

export interface Position {
  title: string;
  dates_worked?: DatesWorked;
  description: string;
  achievements: string[];
}

export interface ContactInfo {
  linkedin?: string;
  github?: string;
  email?: string;
  location?: string;
  phone?: string;
  website?: string;
}

export type  DatesWorked = [Date, Date | null] | null;

/** Parsed YAML before validation: a plain object whose fields haven't been checked yet. */
export type RawResume = Record<string, unknown>;

export interface Intro {
  kind: "summary" | "objective";
  text: string;
}

/** A validated resume, with dates converted and hidden companies removed. */
export interface Resume {
  name: string;
  target_position?: string;
  /** `summary` if present, otherwise `objective`, otherwise null. */
  intro: Intro | null;
  schools: School[];
  skills: Skill[];
  certifications: Certification[];
  companies: Company[];
  contact_info: ContactInfo;
}
