# CLAUDE.md

`yaml-to-resume`: turns a resume written in YAML into validated data and React components. MIT, TypeScript, ESM,
not yet published to npm (`"private": true` stays until Ryan decides to publish from his npm account).

Its first user is Ryan's personal site (`~/projects/my-blog`, `github.com/rawlingsr/blog`), which installs it from
GitHub: `"yaml-to-resume": "github:rawlingsr/yaml-to-resume#semver:^0.2.0"`.

## Commands

Use **pnpm**.

```sh
pnpm install
pnpm lint       # eslint: @eslint/js + typescript-eslint + react-hooks recommended
pnpm typecheck  # tsc -p . (no emit)
pnpm test       # vitest run
pnpm build      # tsdown → dist/ (only needed to pack/publish)
```

Check changes with `pnpm lint`, `pnpm typecheck`, and `pnpm test`; run `pnpm build` too when the build config,
entry points, or exports change.

## Releasing to the site (GitHub dependency)

`exports` point at TypeScript source in `src/`, and GitHub installs don't build anything, so consumers must compile
TypeScript themselves (the site has `transpilePackages: ["yaml-to-resume"]` in `next.config.ts`). That's why `src`
is in `files`: pnpm and npm pack git-hosted dependencies using `files`, and `dist/` is gitignored. pnpm does **not**
apply `publishConfig.exports` to git installs.

Until there's an npm release, `README.md` documents the GitHub install: the `github:...#semver:` command, the
`transpilePackages` line in the Next.js example (a Next 16 build without it fails with "Unknown module type" on
`src/*.ts`), and "works in bundles as long as your bundler compiles it" instead of "runs anywhere".

To release: bump `version`, commit, tag `vX.Y.Z`, push with tags. Then in the site, `pnpm update yaml-to-resume`
(the `#semver:` spec matches the tags) and commit its lockfile. To try unpushed changes in the site, it runs
`pnpm link ../yaml-to-resume` and undoes it with `pnpm install` before committing.

## Tests

Vitest; `vitest.config.mts` sets `TZ=Pacific/Honolulu` on purpose so code that mixes local time and UTC fails in
tests. It includes `test/**/*.test.{ts,tsx}`.

- `test/`: the logic (`deepMerge`, the getters, date validation, `parseResumeYaml`, `normalizeResume`), formatting
  (`format.test.ts`: `monthYear`, `formatDateRange`, `contactLinks`), the Node loader, and the components
  (`react.test.tsx`, rendered with `react-dom/server` `renderToStaticMarkup`, no DOM). Tests import from
  `../src/index`, `../src/node`, or `../src/react/index`.
- Loader tests pass explicit paths to `test/fixtures/*.yaml`; no cwd mock.
- `examples.test.tsx` loads and renders `examples/resume.yaml` (+ override) so the shipped example can't drift from
  the code.

## Layout

```
src/index.ts      # "." entry: types, parseResumeYaml, normalizeResume, getters, format helpers (no fs, no React)
src/node.ts       # "./node" entry: readResumeYaml (raw merged), loadResume (normalized); explicit paths
src/types.ts      # School, Skill, Certification, Company, Position, ContactInfo, DatesWorked, RawResume, Resume, Intro
src/normalize.ts  # asList/asMapping/asText/asUrl shape checks, parseDate, parseDatesWorked, parseHttpUrl, deepMerge, getters, normalizeResume
src/parse.ts      # parseResumeYaml(text, overrideText?): YAML → merged RawResume
src/format.ts     # monthYear, formatDateRange, contactLinks (contact URL rules + validation)
src/react/        # "./react" entry: Resume, ResumeHeader, ContactLinks, Introduction, Education, Experience, Skills(WithKeywords), Certifications
src/styles.css    # "./styles.css" entry: optional default styles for the components, incl. print page breaks
test/             # tests + fixtures (see Tests)
examples/         # resume.yaml + resume.override.yaml: fictional template users copy; shipped and tested
README.md         # the user-facing docs (shipped on npm)
tsdown.config.ts  # build config (see Publishing)
dist/             # build output, gitignored
```

## YAML rules (what the code enforces)

- The top level of each file must be a YAML mapping. YAML syntax errors name the file. Only one override file is
  merged on top of the base.
- `deepMerge`: objects merge key by key. Scalars, arrays, and `null` replace the base value, so overriding `skills`
  or `companies` replaces the whole list.
- `certifications` is optional (missing or `null` → `[]`; a non-list throws). Each entry needs a non-blank `name`.
  `date` goes through `parseDate` like every other date, and `<Certifications>` shows only its UTC year. The 0.2.0
  field `year` was renamed to `date` before anyone else used the package; a leftover `year` throws an error that says
  so. `url` must be a full `http:`/`https:` URL (stricter than `website` fields, which also accept a bare domain).
  Errors name the entry. `<Certifications>` renders nothing for an empty list, which is why it's safe in `<Resume>`'s
  default sections (last).
- Companies **without** `dates_worked` (missing or `null`) are silently dropped; that's how to hide a company.
  Position `dates_worked` is optional. Dates are `[from]` or `[from, to]`; a `to` of null or empty renders as
  "Present".
- Malformed dates throw an error that names the entry: a bad value (e.g. `2020-13`), an empty `dates_worked: []`,
  or a missing `graduation_date`.
- `intro` resolves from `summary` or `objective` (summary wins).
- `contact_info` may be missing or `null` (no contact links). `contactLinks()` owns the URL rules: `website` may be a
  bare domain (gets `https://`) or a full URL; `linkedin`/`github` may be a username or a full URL on that site; any
  other `linkedin`/`github` value throws an error naming the field.

## Conventions

- Framework-neutral: no `next/*` imports and nothing site-specific (paths, branding, FontAwesome). Site-specific
  things come in through props (`logo`, `renderIcon`, `className`).
- Components are server-safe (no hooks, no `"use client"`), and every class name they use starts with `resume-`.
- Plain `<img>` and `<a>` are correct here (not `next/image` / `next/link`).
- The main and `/node` entries must work without React installed.

## Publishing to npm

- **Build:** tsdown, pinned to an exact version (it's 0.x). `tsdown.config.ts` builds ESM `.js` + `.d.ts` for the
  three entries into `dist/` and copies `styles.css`. `platform: "neutral"` (the main and react entries also run in
  browsers), `fixedExtension: false` (plain `.js`/`.d.ts`), and `deps.neverBundle: [/^node:/]`; `yaml` and `react`
  stay external as dependency/peer. Check tsdown option names against its installed `.d.ts` files, not memory.
- **Two sets of exports:** `exports` → `src/` (repo and GitHub installs), `publishConfig.exports` → `dist/`. pnpm
  swaps in `publishConfig.exports` when packing or publishing. Add a new entry point to both.
- **Package metadata:** `files` = `dist`, `src`, `examples`, `README.md`, `LICENSE`. `engines.node >= 22`. React is
  an optional peer (`>=18`). `repository` is set; `homepage` waits on a package homepage (probably a subdomain of
  Ryan's site, on Vercel).
- **Docs:** when the public API, props, or YAML rules change, update `README.md` and, if relevant,
  `examples/resume.yaml` (its test catches drift in the example, not in the README prose).
- **README for npm:** the README describes the GitHub install. Restore the npm wording first: the Install section,
  the Next.js example without the `next.config.ts` / `transpilePackages` snippet, and the "runs anywhere JavaScript
  does (browser, edge, Node)" line in "Without React, or without Node". Tag `v0.1.0` has that version verbatim
  (`git show v0.1.0:README.md`).
- **Before a release,** test the packed package outside this repo (done for 0.1.0, all passing):
  1. `pnpm build`, then `pnpm pack` into a scratch folder. Check with `tar -tzf` that the tarball has only `dist/`,
     `src/`, `examples/`, `README.md`, `LICENSE`, `package.json`, and that its `exports` point at `dist/`.
  2. In an empty `"type": "module"` project, `npm install <tarball> react react-dom` and run a script that
     `loadResume`s the example and renders `<Resume>` with `renderToStaticMarkup`. Also check the main entry without
     React installed.
  3. Type-check a file importing from `.`, `/node`, and `/react` with `tsc --noEmit` under both
     `moduleResolution: bundler` and `node16`.
  4. A fresh Next.js app built from the README's own snippets, **without** `transpilePackages`: `next build`, then
     serve and check the HTML and that the `.resume-*` styles are in the CSS.
