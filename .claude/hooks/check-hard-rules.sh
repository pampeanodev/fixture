#!/usr/bin/env bash
# PreToolUse hook: block Edit/Write that introduce banned patterns documented in CLAUDE.md.
#
# Banned patterns (in *added* content only — old code is grandfathered):
#   1. `: any` or `as any` type annotations (CLAUDE.md hard rule: never use `any`)
#   2. `toLocaleString("es-AR"` (CLAUDE.md hard rule: use formatDate/formatTime from useLocale)
#
# Exit codes:
#   0  → allow
#   2  → block (stderr is shown back to Claude)

set -euo pipefail

payload=$(cat)
tool_name=$(printf '%s' "$payload" | jq -r '.tool_name // empty')
file_path=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')

case "$tool_name" in
  Edit|Write) ;;
  *) exit 0 ;;
esac

case "$file_path" in
  *.ts|*.tsx) ;;
  *) exit 0 ;;
esac

# Skip test files and __tests__ dirs — they may legitimately use `as any` for mocks
case "$file_path" in
  *__tests__*|*.test.ts|*.test.tsx) exit 0 ;;
esac

if [[ "$tool_name" == "Edit" ]]; then
  new_content=$(printf '%s' "$payload" | jq -r '.tool_input.new_string // empty')
elif [[ "$tool_name" == "Write" ]]; then
  new_content=$(printf '%s' "$payload" | jq -r '.tool_input.content // empty')
fi

violations=()

if printf '%s' "$new_content" | grep -nE ':[[:space:]]*any\b|\bas[[:space:]]+any\b' >/dev/null 2>&1; then
  matched=$(printf '%s' "$new_content" | grep -nE ':[[:space:]]*any\b|\bas[[:space:]]+any\b' | head -3)
  violations+=("❌ \`any\` type detected (CLAUDE.md: never use any — use unknown at boundaries and narrow):")
  while IFS= read -r line; do violations+=("     $line"); done <<< "$matched"
fi

if printf '%s' "$new_content" | grep -nE 'toLocaleString\([^)]*"es-AR"' >/dev/null 2>&1; then
  matched=$(printf '%s' "$new_content" | grep -nE 'toLocaleString\([^)]*"es-AR"' | head -3)
  violations+=("❌ raw \`toLocaleString(\"es-AR\")\` detected (CLAUDE.md: use formatDate/formatTime from useLocale()):")
  while IFS= read -r line; do violations+=("     $line"); done <<< "$matched"
fi

if (( ${#violations[@]} > 0 )); then
  {
    echo "Hard-rule violation in ${file_path##*/}:"
    printf '%s\n' "${violations[@]}"
  } >&2
  exit 2
fi

exit 0
