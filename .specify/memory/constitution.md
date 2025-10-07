<!--
Sync Impact Report
- Version change: [unversioned] → 0.1.0
- Modified principles: Placeholder template → Project-specific principles for lightweight feature-first development
- Added sections: Development Workflow, Minimal Governance
- Removed sections: none
- Templates requiring updates: .specify/templates/plan-template.md (✅ updated / aligns), .specify/templates/spec-template.md (✅ aligns), .specify/templates/tasks-template.md (✅ aligns)
- Follow-up TODOs: TODO(RATIFICATION_DATE): supply original ratification date; consider adding CLA/approval process if org requires formal ratification.
-->

# Demo-htmx Constitution

<!-- Constitution for the demo-htmx workspace: lightweight, feature-first rules to guide small projects and specs -->

## Core Principles

### I. Feature-First, Small & Independent

Every new piece of work starts as a small, independently deliverable feature. Features should be scoped so they can be implemented, tested, and demonstrated independently (see spec/user stories P1/P2/P3 pattern).

Rationale: Keeps feedback loops short and reduces coordination overhead for demos and early validation.

### II. Test-First for Critical Flows

For each prioritized user story (P1), tests or acceptance checks must be defined before the implementation proceeds. Tests can be manual acceptance criteria or automated tests where practical.

Rationale: Ensures the MVP delivers verifiable value and guides development.

### III. Data Accuracy & Reconciliation (Non-negotiable)

When changes affect persisted state (e.g., inventory quantities), the system MUST provide an append-only audit trail sufficient to reconcile current state by replaying transactions.

Rationale: For correctness-critical domains (inventory), the ability to reconcile is required to recover from user mistakes and to audit operations.

### IV. Keep Implementation Details Separate from Specs

Specifications must describe WHAT and WHY (user value, acceptance criteria, success metrics). Implementation choices (languages, frameworks, specific databases) belong in plan.md or implementation PRs.

Rationale: Keeps the spec readable to non-technical stakeholders and avoids premature lock-in.

### V. Minimal Viable Governance

Adopt light-weight governance: the constitution defines must-have checks (tests for P1, audit requirements for critical data, basic code review). Heavy approvals (formal CLA or multi-step sign-off) are NOT required for small demos unless organizational policy dictates otherwise.

Rationale: Balance speed of iteration with essential quality gates.

## Additional Constraints & Standards

- Data Integrity: For any feature that updates quantities, balances, or monetary values, audits and tests to reconcile state are mandatory.
- Validation: Input validation and clear user-facing error messages MUST be present for operations that change persisted state.
- Performance: For demo-sized features, aim for responsive UI operations (< 500ms simple interactions) but measure before optimizing.
- Security: Authentication/authorization are out of scope for minimal demos unless required; when present, follow org standards.

## Development Workflow & Quality Gates

- Conventions: Use the project's specify templates (`.specify/templates/*`) and follow the plan → tasks → implementation flow.
- Reviews: All PRs that modify behavior must include: link to spec.md, acceptance test steps, and either automated tests or manual test instructions.
- Gates: A PR changing persisted state (e.g., DB schema, transactions) must include a reconciliation test demonstrating how to rebuild or verify balances from the audit log.
- Releases: For demos, merging to main is allowed once the P1 acceptance test is documented and passes.

## Governance

- Constitution is the source of minimal required checks for this workspace. Amendments should be recorded in this file and include: rationale, impact assessment, and any template updates required.
- Amendments that change non-negotiable items (e.g., Data Accuracy & Reconciliation) must include a migration or mitigation plan.

**Version**: 0.1.0 | **Ratified**: 2025-10-08 | **Last Amended**: 2025-10-08
