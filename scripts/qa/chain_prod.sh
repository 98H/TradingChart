#!/usr/bin/env bash
# scripts/qa/chain_prod.sh — sequential production QA chain for Chartivia.
# Each suite has its own timeout; orphan Chrome is reaped between suites;
# the digest is written to a file (a background notify can arrive truncated).
cd /root/TradingChart
S=/root/.hermes/cache/scratch/qa_runs/chain_prod; mkdir -p "$S"; rm -f "$S"/*.log "$S"/digest.txt
: > "$S/progress.log"
reap(){ for p in $(pgrep -f "qa_chrome_profile"); do kill "$p" 2>/dev/null; done; sleep 2; }
run(){ local tag=$1; shift; timeout -k 10 "${T:-500}" "$@" > "$S/$tag.log" 2>&1; echo "$? $tag" >> "$S/progress.log"; reap; }
bash scripts/qa/security_smoke.sh > "$S/security.log" 2>&1; echo "$? security" >> "$S/progress.log"
for m in "desktop fa" "desktop en" "mobile fa" "mobile en"; do set -- $m
  run "landing_$1_$2" node tests/qa_landing.cjs "$1" "$2"
  run "prod1_$1_$2" node tests/qa_prod_cycle1.cjs "$1" "$2"
done
for m in "desktop fa" "desktop en" "mobile fa" "mobile en"; do set -- $m
  T=900 run "sweep_$1_$2" node tests/qa_r1_sweep.cjs "$1" "$2"
done
{ echo "== digest"; cat "$S/progress.log"; grep -h "Total:" "$S/security.log"
  grep -hE "❌|defects across" "$S"/landing_*.log "$S"/prod1_*.log
  grep -hE "^(✗|ERR|== )" "$S"/sweep_*.log | cut -c1-300; } > "$S/digest.txt"
cat "$S/digest.txt"
