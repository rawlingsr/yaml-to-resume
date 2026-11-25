import type { Certification } from "../types";

/** A compact list of certifications. Renders nothing when there are none. */
export function Certifications({ certifications }: { certifications: Certification[] }) {
  if (certifications.length === 0) {
    return null;
  }
  return (
    <article className="resume-certifications">
      <h2>Certifications</h2>
      <ul className="resume-certification-list">
        {certifications.map((certification, index) => (
          <li key={index}>
            {certification.url ? <a href={certification.url}>{certification.name}</a> : certification.name}
            {certification.issuer ? `, ${certification.issuer}` : null}
            {certification.year ? `, ${certification.year}` : null}
          </li>
        ))}
      </ul>
    </article>
  );
}
