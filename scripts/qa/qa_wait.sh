#!/usr/bin/env bash
# scripts/qa/qa_wait.sh <tag> [max_seconds=540] — waits for a qa_run.sh job.
# Prints "DONE <exit_code> <elapsed_seconds>" or "STILL_RUNNING" (call again to keep waiting).
tag=${1:?usage: qa_wait.sh <tag> [max_seconds]}; max=${2:-540}
D=/root/.hermes/cache/scratch/qa_runs; t=0
while [ ! -f "$D/$tag.exit" ] && [ "$t" -lt "$max" ]; do sleep 5; t=$((t+5)); done
if [ -f "$D/$tag.exit" ]; then echo "DONE $(cat "$D/$tag.exit")"; else echo "STILL_RUNNING (log: $D/$tag.log)"; fi
