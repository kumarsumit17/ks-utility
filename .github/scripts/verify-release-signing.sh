#!/usr/bin/env bash
# Proves whether a release APK and AAB are signed. A successful Gradle build is not proof:
# with no usable keystore, Gradle quietly produces unsigned output.
#
#   verify-release-signing.sh signed   <apk> <aab> [expected-cert-sha256]
#   verify-release-signing.sh unsigned <apk> <aab>
#
# signed:   both files must carry a valid signature from the same certificate. If an expected
#           SHA-256 fingerprint is given (the one read from the keystore), both must match it.
#           A debug certificate is rejected.
# unsigned: both files must carry no signature at all, so a signed build can never be
#           labelled unsigned (or the reverse).
#
# Prints certificate fingerprints, which are public. It never reads or prints key material.
set -euo pipefail
# With pipefail, never pipe a large variable into `grep -q` or `head`: they stop reading early,
# the writer gets SIGPIPE and the check fails although it matched (v0.6.0's release run). Use
# `grep -q PATTERN <<< "$var"`, and `sed -n '1p'` (reads everything) in place of `head -n 1`.

mode="${1:-}"
apk="${2:-}"
aab="${3:-}"
expected="${4:-}"

fail() {
  echo "::error::$*"
  exit 1
}

# Lower-case hex without separators, so fingerprints from different tools compare equal.
normalise() {
  tr -d ': \r\n' | tr 'A-F' 'a-f'
}

summary() {
  if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then echo "$*" >> "$GITHUB_STEP_SUMMARY"; fi
}

output() {
  if [ -n "${GITHUB_OUTPUT:-}" ]; then echo "$1=$2" >> "$GITHUB_OUTPUT"; fi
}

find_apksigner() {
  if [ -n "${APKSIGNER:-}" ]; then
    echo "$APKSIGNER"
    return
  fi
  if command -v apksigner > /dev/null 2>&1; then
    command -v apksigner
    return
  fi
  local sdk="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
  [ -n "$sdk" ] || fail "apksigner not found: ANDROID_HOME is not set."
  local newest
  newest="$(find "$sdk/build-tools" -mindepth 2 -maxdepth 2 -name apksigner 2> /dev/null | sort -V | tail -n 1)"
  [ -n "$newest" ] || fail "apksigner not found under $sdk/build-tools."
  echo "$newest"
}

signature_entries() {
  unzip -Z1 "$1" | grep -E '^META-INF/[^/]+\.(RSA|DSA|EC|SF)$' || true
}

[ "$mode" = "signed" ] || [ "$mode" = "unsigned" ] || fail "First argument must be 'signed' or 'unsigned'."
[ -s "$apk" ] || fail "APK is missing or empty: $apk"
[ -s "$aab" ] || fail "AAB is missing or empty: $aab"
command -v jarsigner > /dev/null 2>&1 || fail "jarsigner not found (it ships with the JDK)."
command -v keytool > /dev/null 2>&1 || fail "keytool not found (it ships with the JDK)."

apksigner="$(find_apksigner)"
echo "Using apksigner: $apksigner"

# ------------------------------------------------------------------ unsigned
if [ "$mode" = "unsigned" ]; then
  if "$apksigner" verify "$apk" > /dev/null 2>&1; then
    fail "The APK is signed, but this build is labelled unsigned: $apk"
  fi
  echo "APK carries no valid signature, as expected."

  jar_report="$(jarsigner -verify "$aab" 2>&1 || true)"
  grep -q 'jar is unsigned' <<< "$jar_report" || fail "The AAB is not unsigned, but this build is labelled unsigned: $aab"
  [ -z "$(signature_entries "$aab")" ] || fail "The AAB contains signature files, but this build is labelled unsigned."
  echo "AAB carries no signature, as expected."

  output confirmed_unsigned true
  exit 0
fi

# -------------------------------------------------------------------- signed
echo "::group::apksigner verify --verbose --print-certs"
apk_report="$("$apksigner" verify --verbose --print-certs "$apk" 2>&1)" || {
  echo "$apk_report"
  echo "::endgroup::"
  fail "APK signature verification failed: $apk"
}
echo "$apk_report"
echo "::endgroup::"

grep -q '^Verifies' <<< "$apk_report" || fail "apksigner did not report 'Verifies' for $apk"
apk_sha="$(grep -E 'certificate SHA-256 digest: ' <<< "$apk_report" | sed -n '1{s/.*digest: //;p;}' | normalise)"
grep -Eq '^[0-9a-f]{64}$' <<< "$apk_sha" || fail "The APK has no signing certificate (no SHA-256 digest reported)."

if grep -Eq 'certificate DN: .*CN=Android Debug' <<< "$apk_report"; then
  [ "${ALLOW_DEBUG_CERT:-}" = "true" ] || fail "The APK is signed with the Android debug certificate, not a release key."
  echo "::warning::APK is signed with the Android debug certificate (allowed for this local check only)."
fi

echo "::group::jarsigner -verify -verbose -certs"
jar_report="$(jarsigner -verify -verbose -certs "$aab" 2>&1)" || {
  echo "$jar_report" | tail -n 40
  echo "::endgroup::"
  fail "AAB signature verification failed: $aab"
}
# The verbose listing has one block per file in the bundle, and newer JDKs add a per-entry
# "signed in JarFile but is not signed in JarInputStream" note for bundles. Neither is the
# verdict, so show the end of the report without those notes.
echo "$jar_report" | grep -vE '^- Entry ' | tail -n 40
echo "::endgroup::"

# jarsigner exits 0 for an unsigned jar, so the verdict text is what counts.
if grep -q 'jar is unsigned' <<< "$jar_report"; then fail "The AAB is unsigned: $aab"; fi
grep -q '^jar verified' <<< "$jar_report" || fail "jarsigner did not report 'jar verified' for $aab"

entries="$(signature_entries "$aab")"
grep -Eq '\.SF$' <<< "$entries" || fail "The AAB has no signature file (META-INF/*.SF)."
grep -Eq '\.(RSA|DSA|EC)$' <<< "$entries" || fail "The AAB has no signature block (META-INF/*.RSA, *.DSA or *.EC)."
echo "AAB signature metadata:"
echo "$entries" | sed 's/^/  /'

aab_sha="$(keytool -printcert -jarfile "$aab" 2> /dev/null | grep -E 'SHA-?256:' | sed -n '1{s/.*SHA-\{0,1\}256: *//;p;}' | normalise)"
grep -Eq '^[0-9a-f]{64}$' <<< "$aab_sha" || fail "Could not read the signing certificate from the AAB."

echo "APK certificate SHA-256: $apk_sha"
echo "AAB certificate SHA-256: $aab_sha"

[ "$apk_sha" = "$aab_sha" ] || fail "The APK and the AAB are signed with different certificates."
if [ -n "$expected" ]; then
  expected_sha="$(echo "$expected" | normalise)"
  [ "$apk_sha" = "$expected_sha" ] || fail "The artifacts are not signed with the certificate from the configured keystore."
  echo "Both match the certificate in the configured keystore."
fi

output verified true
output cert_sha256 "$apk_sha"
summary "- APK signature: verified with \`apksigner\`"
summary "- AAB signature: verified with \`jarsigner\`"
summary "- Signing certificate SHA-256: \`$apk_sha\`"
echo "Signed build verified."
