#!/usr/bin/env bash
# scripts/qa/qa_run.sh <tag> '<shell command>'
# Runs <command> detached from /root/TradingChart while holding the shared QA lock, so browser
# tests, probes and builds never overlap on this 3-CPU box. Hard cap per run: 25 min.
# Log: /root/.hermes/cache/scratch/qa_runs/<tag>.log ; on finish <tag>.exit = "<exit_code> <secs>"
set -u
tag=${1:?usage: qa_run.sh <tag> <command>}; cmd=${2:?usage: qa_run.sh <tag> <command>}
D=/root/.hermes/cache/scratch/qa_runs
mkdir -p "$D"; rm -f "$D/$tag.exit"
QA_CMD=$cmd QA_LOG=$D/$tag.log QA_EXIT=$D/$tag.exit nohup bash -c '
  start=$(date +%s)
  cd /root/TradingChart && flock /run/lock/tc-qa.lock timeout -k 15 1500 bash -c "$QA_CMD" >"$QA_LOG" 2>&1
  code=$?
  echo "$code $(( $(date +%s) - start ))" >"$QA_EXIT"
' >/dev/null 2>&1 &
echo "started tag=$tag pid=$!"
