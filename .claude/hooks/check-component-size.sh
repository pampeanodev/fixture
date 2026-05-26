#!/usr/bin/env bash
# PreToolUse hook: block Edit/Write to .tsx components in src/components/ already over
# the 200-line limit, IF the edit would grow the file further. Files at or below 200
# pass freely. Files already over 200 can be edited as long as they don't grow (you can
# shrink or stay flat).
#
# Exit codes:
#   0  → allow
#   2  → block

set -euo pipefail

LIMIT=200

payload=$(cat)
tool_name=$(printf '%s' "$payload" | jq -r '.tool_name // empty')
file_path=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')

case "$tool_name" in
  Edit|Write) ;;
  *) exit 0 ;;
esac

case "$file_path" in
  *.tsx) ;;
  *) exit 0 ;;
esac

case "$file_path" in
  */src/components/*) ;;
  *) exit 0 ;;
esac

[[ -f "$file_path" ]] || exit 0

current=$(wc -l < "$file_path" | tr -d ' ')

if [[ "$tool_name" == "Write" ]]; then
  content=$(printf '%s' "$payload" | jq -r '.tool_input.content // empty')
  projected=$(printf '%s\n' "$content" | wc -l | tr -d ' ')
elif [[ "$tool_name" == "Edit" ]]; then
  old_str=$(printf '%s' "$payload" | jq -r '.tool_input.old_string // empty')
  new_str=$(printf '%s' "$payload" | jq -r '.tool_input.new_string // empty')
  old_nl=$(printf '%s' "$old_str" | awk 'END{print NR}')
  new_nl=$(printf '%s' "$new_str" | awk 'END{print NR}')
  delta=$((new_nl - old_nl))
  projected=$((current + delta))
fi

if (( current > LIMIT )) && (( projected > current )); then
  cat >&2 <<EOF
❌ ${file_path##*/}: ${current} → ${projected} lines (limit: ${LIMIT})
   File already over ${LIMIT}-line limit.
   Refactor existing code into sub-components in src/components/<feature>/
   instead of adding more lines.
EOF
  exit 2
fi

exit 0
