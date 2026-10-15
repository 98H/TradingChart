#!/usr/bin/env bash
# scripts/qa/run_regression.sh <outdir> <suite[:arg]>...   (launch detached: nohup bash run_regression.sh ... >/dev/null 2>&1 &)
# Runs suites sequentially; each run holds the shared QA lock only while it executes.
# Per suite: <outdir>/<tag>.log and <outdir>/<tag>.exit ("<exit> <secs>"); progress: <outdir>/progress.log
set -u
LOCK=/root/.hermes/cache/scratch/tc-qa.lock
OUT=${1:?usage: run_regression.sh <outdir> <suite[:arg]>...}; shift
mkdir -p "$OUT"; cd /root/TradingChart || exit 2
for spec in "$@"; do
  suite=${spec%%:*}; arg=""; [[ $spec == *:* ]] && arg=${spec#*:}
  tag=$suite${arg:+_$arg}; pre=""
  [[ $suite == qa_admin* ]] && pre="sleep 62;"   # admin unlock limiter: 5/min per IP
  echo "$(date -u +%FT%TZ) START $tag" >>"$OUT/progress.log"
  start=$(date +%s)
  flock "$LOCK" bash -c "$pre timeout 1500 node tests/$suite.cjs $arg" >"$OUT/$tag.log" 2>&1
  code=$?; secs=$(( $(date +%s) - start ))
  echo "$code $secs" >"$OUT/$tag.exit"
  echo "$(date -u +%FT%TZ) END $tag exit=$code secs=$secs" >>"$OUT/progress.log"
  sleep 40   # let per-IP register/login limiters drain before the next suite
done
echo "$(date -u +%FT%TZ) ALL_DONE" >>"$OUT/progress.log"
