import type { Skill } from "../types";

export function Skills({ skills }: { skills: Skill[] }) {
  return (
    <article className="resume-skills">
      <h2>Skills</h2>
      <ul className="resume-skill-list">
        {skills.map((skill, index) => <li key={index}>{skill.name}</li>)}
      </ul>
    </article>
  );
}

export function SkillsWithKeywords({ skills }: { skills: Skill[] }) {
  return (
    <article className="resume-skills">
      <h2>Skills</h2>
      <ul className="resume-skill-list-keywords">
        {skills.map((skill, index) => (
          <li key={index}>
            {skill.name}
            <Keywords keywords={skill.keywords} />
          </li>
        ))}
      </ul>
    </article>
  );
}

function Keywords({ keywords }: { keywords?: string[] }) {
  if (!keywords) {
    return null;
  }
  return (
    <ul className="resume-skill-keywords">
      {keywords.map((keyword, index) => <li key={index}>{keyword}</li>)}
    </ul>
  );
}
