---
name: warn-i18n-consistency
enabled: true
event: file
conditions:
  - field: file_path
    operator: regex_match
    pattern: src/i18n/locales/(es|en|pt)\.ts$
---

🌐 **i18n locale bundle edited.**

The 3 locale files (`es.ts`, `en.ts`, `pt.ts`) must have **identical key shape**. Before committing:

- If you added/renamed/removed a key in any file, mirror the change in the other two.
- `es.ts` is the source of truth — all keys must exist there first, then in `en.ts` and `pt.ts`.
- The `satisfies Messages` check catches missing/extra keys at compile time, but a runtime consistency test also guards it.

**Verify before commit:**

```
pnpm test -- locales.consistency
pnpm test -- teams.consistency
pnpm tsc -b
```

If any of those fail, fix before committing. See `docs/reference/i18n.md` for the full contract.
