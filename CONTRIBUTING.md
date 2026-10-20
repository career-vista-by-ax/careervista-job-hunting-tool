# Contributing to CareerVista

Canonical repository: <https://github.com/career-vista-by-ax/careervista-job-hunting-tool>.

CareerVista helps people find Australian jobs, understand their fit, prepare
truthful application documents and maintain their own records. The person
remains in control of career decisions and application submission.

This repository is currently private. Licensing and public distribution terms
will be decided separately; this document does not establish a licence.

## Product boundaries

### No auto-apply

We will not develop an auto-apply flow for the foreseeable future. Contributions
must not add automatic, agent-submitted or batch application submission,
background application bots, or scripted application-form completion/submission.
An agent must not click through an application on the user's behalf.

Supported work includes job research, evidence-linked recommendations, CV and
cover-letter tailoring, the 30-second reader review, user-authorised editing of
those documents, interview preparation, local progress tracking and reminders.
Preparing documents or opening an advert must never mark a job as applied.
The user submits the application and records or confirms its outcome.

### Preserve the original advert's application route

Always recommend applying through the original advert on the website where the
role was found, using that site's own **Apply** button. This includes following
a job board's normal link-out flow when the user clicks it themselves.

Never bypass SEEK, LinkedIn or another originating platform by extracting,
following or guessing a direct employer/ATS application link and presenting it
as an alternative route. A direct employer advert is the application route only
when the job was originally found on that employer's website. When provenance
is unclear, ask for the original advert. Preserve platform attribution and the
originating site's application flow.

## Skills and runtime are separate

Skills are portable Markdown instructions, installable independently from the
website. Docker and native releases are runtime options, not skill installers.
Use the host agent's available shell, browser, HTTP and document tools; explain
missing capabilities without claiming universal host compatibility.

Onboarding should reuse a verified existing connection or ask Docker versus a
local copy, one question at a time. Obtain permission before concrete Docker
pull/start/update actions. Use a persistent named volume and publish only to
loopback. For a local copy, ask whether it is already downloaded and request
its path, or guide an agreed download. Preserve existing data during updates.

## Evidence, documents and user control

- Save original source text, URLs and capture times before analysis. Distinguish
  facts, employer claims, inference and unknowns; retain contradictory evidence.
- Keep English job evidence and original quotations unchanged. Store translated
  explanations separately with English lineage. Language choices are English,
  简体中文 and 繁体中文, without country or region qualifiers.
- Preserve base CVs and earlier variants. Tailoring and a simulated 30-second
  review must not invent achievements, numbers, qualifications or ownership.
  Let users choose their own editing tool, a separate draft or authorised editor
  control. Render and inspect document exports when making layout claims.
- Keep archive, Recently deleted and permanent reset distinct. Deletion must be
  recoverable until the user explicitly chooses permanent removal; remember
  deleted source listings to avoid reintroducing them in subsequent searches.
- Full reset requires two confirmations, with exact `DELETE` at the final step.
  Never reset or remove a Docker data volume as part of ordinary startup/update.
- Contacts, application answers and document copies are private local records.
  Preserve them in private backups, avoid credential leakage, and describe the
  actual reminder delivery mechanism accurately.

## Development and validation

Use the runtime pinned in `package.json` and the lockfile. Run `npm ci`,
`npm run check`, `npm run build` and `npm test` as appropriate. Tests that bind
loopback ports or exercise packaged installs need the corresponding local host
permissions. Do not report platform tests that were skipped as passing.

Test meaningful behaviour: persistence, evidence lineage, rollback, confirmation
and recovery, source suppression, document-copy integrity, old-backup recovery,
and populated upgrades. Check affected UI on desktop and mobile widths with
keyboard and error states. Preserve the established visual system outside the
requested change.

Use isolated data roots, containers and labelled test volumes. Cleanup must
remove only resources owned by that test. Never test destructive flows against
someone's live job history or reuse browser credentials as fixtures.

Release immutable, versioned artifacts with hashes and provenance. Exercise the
actual extracted launcher or container replacement path against populated data,
and verify preserved records. Keep native and Docker instructions explicit;
a locally built image is not a published registry image. Public publication,
registry ownership and licensing decisions remain separate from local testing.
