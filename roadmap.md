# IRIS tasks

## Access and CEO continuity

- [ ] Compare files-listo.zip and the supplied repair instructions with current IRIS.
- [ ] Verify the real CEO profile, role and profile-creation trigger without weakening authentication.
- [ ] Distinguish missing profiles from data-loading failures and add focused tests.
- [ ] Run available checks and report any repair that remains unnecessary or unverified.

## Organizational administration

- [ ] Compare the organizational module in files-listo.zip with current IRIS; do not import unrelated workspace, sales, inventory, purchasing, budget, task or risk modules.
- [ ] Integrate the missing department, position, role, effective-permission, assignment, restriction, audit and security behavior without duplicating existing structures.
- [ ] Adapt and apply only the necessary organizational migrations and RLS policies, preserving existing data and CEO authority.
- [ ] Connect the existing department and permission screens to the integrated real-data behavior.
- [ ] Repair the incomplete organizational test fixtures and run authorization, browser, type and build checks.
- [ ] Report changed files, applied migrations, executed tests and remaining limitations; do not deploy.