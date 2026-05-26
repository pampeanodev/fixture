---
name: add-locale-key
description: Add a new i18n key across es/en/pt locale files and verify consistency. ES is the source of truth; EN/PT get TODO markers that should be translated later via the i18n-translator subagent.
disable-model-invocation: true
---

# Add Locale Key

User-invoked workflow to add a new i18n key without breaking the `locales.consistency` test.

## Args

```
/add-locale-key <dot.path> "<ES value>"
```

Examples:
- `/add-locale-key common.helpClose "Cerrar ayuda"`
- `/add-locale-key autoSync.retrying "Reintentando..."`
- `/add-locale-key bracket.matchSummary "{home} {homeScore} - {awayScore} {away}"`

## Steps

1. Validate the dot-path: must use existing top-level namespaces in `src/i18n/locales/es.ts` (e.g. `common`, `autoSync`, `bracket`, `nostr`, `simulator`). If creating a new top-level namespace, ask the user to confirm first.
2. Open `src/i18n/locales/es.ts` and insert the key at the end of its namespace. Preserve indentation (2 spaces).
3. Open `src/i18n/locales/en.ts` and insert at the same path. Value: `"[EN] <ES value>"` as a translation TODO marker.
4. Open `src/i18n/locales/pt.ts` and insert at the same path. Value: `"[PT] <ES value>"`.
5. Run `pnpm test -- locales.consistency` and `pnpm test -- teams.consistency`.
6. If either test fails, print the diff and stop — do NOT attempt to auto-fix without re-checking with the user.
7. If both pass, run `pnpm tsc -b --noEmit` to confirm `satisfies Messages` still holds.
8. Print a summary:
   ```
   ✅ Added <path> to es/en/pt
   ⏭️  EN and PT have TODO markers — run i18n-translator to get real translations.
   ```

## Hard rules

- Never use `any` types — if you need to change the `Messages` type to accept new shapes, ask first.
- Never run `git commit` — only the user commits.
- Preserve the order ES → EN → PT (ES leads).
- If the value contains `{placeholder}` tokens, mirror them exactly in EN and PT — they're consumed by `Trans`.

## Reference

See `docs/reference/i18n.md` for the full contract: locale detection, plural rules, `Trans` component, and the consistency tests this skill protects.
