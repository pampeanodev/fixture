#!/usr/bin/env bash
# PostToolUse hook: after Edit/Write to src/{utils,nostr,simulator,i18n}/<name>.ts,
# run the matching __tests__/<name>.test.ts if it exists. Non-blocking — failures
# print to stderr (visible to Claude) but the tool call already succeeded.
#
# Skipped if:
#   - File is itself a test file
#   - No matching test exists
#   - File is not in one of the pure-logic dirs

set -euo pipefail

payload=$(cat)
tool_name=$(printf '%s' "$payload" | jq -r '.tool_name // empty')
file_path=$(printf '%s' "$payload" | jq -r '.tool_input.file_path // empty')

case "$tool_name" in
  Edit|Write) ;;
  *) exit 0 ;;
esac

case "$file_path" in
  *__tests__*|*.test.ts|*.test.tsx) exit 0 ;;
esac

# Match: src/<area>/<file>.ts where area is one of the pure-logic dirs
if [[ ! "$file_path" =~ /src/(utils|nostr|simulator|i18n)/([^/]+)\.tsx?$ ]]; then
  exit 0
fi

area="${BASH_REMATCH[1]}"
basename="${BASH_REMATCH[2]}"

# Locate the project root by walking up from the file
project_root="${file_path%/src/*}"
test_file="${project_root}/src/${area}/__tests__/${basename}.test.ts"
test_file_tsx="${project_root}/src/${area}/__tests__/${basename}.test.tsx"

if [[ -f "$test_file" ]]; then
  target="$test_file"
elif [[ -f "$test_file_tsx" ]]; then
  target="$test_file_tsx"
else
  exit 0
fi

cd "$project_root"
echo "▶ Running affected test: ${target#$project_root/}" >&2
if ! pnpm vitest run "$target" 2>&1 | tail -20 >&2; then
  echo "❌ Affected test failed — review before continuing" >&2
fi

exit 0
