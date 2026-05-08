# Feature Branch Procedure

## Goal

Use a consistent lightweight workflow for feature delivery and integration.

## Steps

1. **Checkout a feature branch**
   - Create or switch to a dedicated branch for the task.
   - Keep the branch focused on one feature area.

2. **Implement the changes**
   - Apply code changes according to project conventions.
   - Preserve existing behavior unless the task explicitly changes behavior.

3. **Update documentation**
   - Reflect architecture, flow, and affected modules in README and technical docs.
   - Keep docs aligned with the final code structure.

4. **Merge back into `main`**
   - Commit the feature branch changes.
   - Merge branch into `main` (prefer non-destructive standard merge flow).

5. **Delete the feature branch**
   - Remove the local feature branch after successful merge.
   - Keep branch hygiene simple and avoid stale branches.
