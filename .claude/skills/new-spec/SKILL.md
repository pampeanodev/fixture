---
name: new-spec
description: Scaffold a new design spec under docs/superpowers/specs/ using the fX.Y-slug feature-ID convention. Reads the spec registry to pick the next available sub-feature ID, then creates the file with frontmatter and a standard section skeleton.
---

# New Spec

Creates a new design spec following the project's feature-ID scheme.

## Args

```
/new-spec <area-id> <slug>
```

Examples:
- `/new-spec f1 trans-component` → creates `f1.<next>-trans-component.md` under area f1 (i18n)
- `/new-spec f2 relay-pool-rotation` → `f2.<next>-relay-pool-rotation.md`

## Steps

1. **Validate area**: read `docs/superpowers/specs/README.md` and confirm `<area-id>` (e.g. `f1`) exists in the Areas table. If not, STOP and tell the user to add the area to the README first (areas are meant to be stable, not invented ad-hoc).
2. **Pick next sub-feature ID**: scan the "Reserved sub-feature IDs" table for the highest existing `Y` under `<area-id>`. New ID = `<area-id>.<Y+1>`.
3. **Reserve the ID**: add a row to the Reserved IDs table in the README with the new `fX.Y`, slug, filename, and today's date. Do this BEFORE creating the spec file (so concurrent work doesn't collide).
4. **Create the spec file** at `docs/superpowers/specs/fX.Y-<slug>.md` with this skeleton:

   ```markdown
   ---
   id: fX.Y
   area: <area-name-from-README>
   slug: <slug>
   created: <today>
   status: draft
   ---

   # <Title — derive from slug, Title Case>

   ## 1. Problem

   <What user-visible or system pain motivates this spec? Why now?>

   ## 2. Goals

   - Goal 1
   - Goal 2

   ## 3. Non-goals

   - Out of scope: X
   - Out of scope: Y

   ## 4. Design

   <The substance. Diagrams welcome. Reference adjacent specs and `docs/reference/` docs by ID.>

   ## 5. Trade-offs

   <Alternatives considered and why they were rejected.>

   ## 6. Open questions

   - [ ] Q1
   - [ ] Q2

   ## 7. Implementation notes

   <Anything an implementer needs to know that isn't obvious from the design section — e.g. order of work, migration concerns, test strategy.>
   ```

5. **Print** the path of the new spec and a reminder:
   ```
   ✅ Created docs/superpowers/specs/fX.Y-<slug>.md (reserved in README)
   👉 Fill in sections 1–7. Update status: approved when ready to implement.
   ```

## Rules

- Never invent area IDs — always reuse one from the README's Areas table.
- Never skip the README update step — the registry must stay in sync.
- Specs are immutable design snapshots. If something changes, supersede with a new spec (`supersedes: fX.Y` in frontmatter) rather than rewriting history.
- Today's date in `created:` uses ISO format: `YYYY-MM-DD`.

## Reference

See `docs/superpowers/specs/README.md` for the full naming convention, area definitions, and the relationship between `specs/`, `reference/`, and `plans/`.
