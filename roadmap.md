# IRIS tasks

## Access and CEO continuity

- [x] Compare files-listo.zip and the supplied repair instructions with current IRIS.
- [x] Verify the real CEO profile, role and profile-creation trigger without weakening authentication.
- [x] Distinguish missing profiles from data-loading failures and add focused tests.
- [x] Run available checks and report any repair that remains unnecessary or unverified.

## Organizational administration

- [x] Compare the organizational module in files-listo.zip with current IRIS; do not import unrelated workspace, sales, inventory, purchasing, budget, task or risk modules.
- [x] Integrate the missing department, position, role, effective-permission, assignment, restriction, audit and security behavior without duplicating existing structures.
- [x] Adapt and apply only the necessary organizational migrations and RLS policies, preserving existing data and CEO authority.
- [x] Connect the existing department and permission screens to the integrated real-data behavior.
- [x] Repair the incomplete organizational test fixtures and run authorization, backend, type and build checks.
- [x] Report changed files, applied migrations, executed tests and remaining limitations; do not deploy.
- [ ] Visually review the organization screens with the real CEO after the mandatory password change; blocked because only the CEO may choose the new password.

## Final authorization sweep

- [x] Inspect every organization screen, mutation, server function, policy and background entry point for scoped authorization and self-escalation.
- [x] Fix only violations inside Departments and Permissions; leave unrelated modules and settled records unchanged.
- [x] Repeat focused and full verification, then report each checked place and any remaining limitation.

## Unified department changes

- [x] Replace the legacy setUserDepartment mechanism with the secure organization function while preserving its import path.
- [x] Distinguish profile-linked departmental roles from explicitly scoped roles and update only profile-linked scopes after a move.
- [x] Verify previous-head removal, old/new traceability, organization history, audit, effective permissions and duplicate prevention with a temporary user.
- [x] Run focused and full tests, typecheck, build and real server-function verification without changing unrelated modules.