AI Tools Used

Primary AI Tools:

* ChatGPT
* Claude (Anthropic)

These tools were used as development assistants for planning, debugging, code reviews, architecture discussions, testing support, and documentation. All generated outputs were reviewed, modified where necessary, and validated before being incorporated into the project.

⸻

How AI Was Used During Development

Project Planning

AI was used to:

* Break down the assignment into development phases.
* Discuss possible database designs.
* Evaluate approaches for handling changing group membership.
* Review implementation plans before coding.

Final architectural decisions were made after comparing alternatives and validating them against the assignment requirements.

⸻

Backend Development

AI assisted with:

* Reviewing Prisma schema designs.
* Suggesting approaches for implementing Equal, Percentage, Exact, and Share split types.
* Discussing balance calculation strategies.
* Reviewing API route structures.
* Identifying edge cases in financial calculations.

All business logic and financial calculations were manually reviewed and verified through testing.

⸻

CSV Import & Anomaly Detection

AI was used to:

* Brainstorm possible anomalies in the provided CSV.
* Suggest validation strategies for dates, currencies, duplicates, settlements, and membership conflicts.
* Review importer workflows and dry-run architecture.

The final anomaly handling policies were chosen and documented manually.

⸻

Frontend Development

AI assisted with:

* UI structure suggestions.
* Component organization.
* Form validation logic.
* Accessibility improvements.
* Responsive design recommendations.

The final interface was customized and refined manually.

⸻

Testing & Deployment

AI was used to:

* Suggest unit and integration test scenarios.
* Review Playwright test coverage.
* Diagnose build and deployment issues.
* Assist in debugging authentication and database configuration problems.

All fixes were verified through local testing and deployment validation.

⸻

Examples Where AI Was Wrong

Example 1: Prisma Schema Recovery

AI Suggestion

After connecting Prisma to a remote database, AI suggested generating the schema from the database structure.

Issue

The connected database belonged to a different project, which produced an incorrect schema.

Resolution

I restored the original schema from Git history, regenerated the Prisma client, and verified all migrations before proceeding.

⸻

Example 2: User Authentication Design

AI Suggestion

Use mandatory email and password fields for every user.

Issue

The application supports guest participants who do not have login credentials.

Resolution

I modified the design by introducing guest-user handling and separating authenticated users from guest participants.

⸻

Example 3: Deployment Readiness

AI Suggestion

The project appeared deployment-ready after local tests passed.

Issue

The production database configuration was not fully aligned with the intended deployment environment.

Resolution

I verified the database configuration, applied migrations to the correct environment, reseeded the database, and reran the full test suite before deployment.

⸻

Validation Process

Every AI-generated suggestion was reviewed before adoption.

Validation methods included:

* Prisma migration verification
* Database integrity checks
* Vitest unit testing
* Playwright end-to-end testing
* Manual UI testing
* Production build verification (npm run build)
* Deployment testing on the hosted environment

AI was used as a development assistant, while all final implementation decisions, testing, debugging, and submission responsibility remained with me.