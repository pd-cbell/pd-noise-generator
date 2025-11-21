#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <workspace> [INITIALS]" >&2
  echo "Example: $0 cb CB" >&2
  exit 1
fi

WS="$1"
INITS="${2:-${WS^^}}"

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
TEMPLATE="$ROOT_DIR/crux/payload_import.template.json"
OUT="$ROOT_DIR/crux/payload_import.${WS}.json"

if [[ ! -f "$TEMPLATE" ]]; then
  echo "Template not found: $TEMPLATE" >&2
  exit 1
fi

# Append " - <INITS>" to every service_name value inside the escaped JSON string
# Use jq to:
# - set routing_key on every event item (new default key)
# - decode each payload JSON, append suffix to custom_details.service_name when present, then re-encode
# EXACTNESS GUARANTEE:
# - Do not reformat or reserialize payload JSON strings
# - Only two changes allowed:
#   (1) Replace existing routing_key values with NEW_KEY (do not add if missing)
#   (2) Append " - <INITS>" to values of service_name fields inside payload strings, if present and not already suffixed

NEW_KEY="R027XIGRNBMERUYO7I0JDKG991JXDJ5F"

INFILE="$TEMPLATE"
OUTFILE="$OUT"

export INITS
export NEW_KEY

perl -0777 - "$INFILE" > "$OUTFILE" <<'PERL'
  my $inits = $ENV{INITS};
  my $newk  = $ENV{NEW_KEY};
  local $/; $_ = <>;
  # (1) Update routing_key if present
  s/("routing_key"\s*:\s*")([^"]*)(")/$1.$newk.$3/eg;
  # (2) Append suffix to service_name values inside escaped payload JSON strings
  my $suf = " - $inits";
  s/(\\"service_name\\"\s*:\s*\\"[^\\"]+)/$&$suf/g;
  print;
PERL

echo "Wrote: $OUT"
