#!/usr/bin/env bash
# scripts/qa/security_smoke.sh — API-level security regression for Chartivia.
# Usage: bash scripts/qa/security_smoke.sh [base_url]
B=${1:-${SDD_BASE_URL:-http://127.0.0.1:8088}}
pass=0; fail=0
ok(){ echo "✅ $1"; pass=$((pass+1)); }
ko(){ echo "❌ $1  (got: $2)"; fail=$((fail+1)); }
code(){ curl -s -o /dev/null -w '%{http_code}' "$@"; }

H=$(curl -sI "$B/")
for h in content-security-policy x-content-type-options x-frame-options referrer-policy permissions-policy; do
  echo "$H" | grep -qi "^$h:" && ok "header $h" || ko "header $h" missing
done
echo "$H" | grep -qi '^x-powered-by' && ko "x-powered-by hidden" present || ok "x-powered-by hidden"
echo "$H" | grep -qi '^access-control-allow-origin' && ko "no CORS on HTML" present || ok "no CORS on HTML"

c=$(curl -s "$B/api/health"); echo "$c" | grep -q memory && ko "health leaks internals" "$c" || ok "health is liveness-only"
c=$(code -X POST "$B/api/webhook" -H 'content-type: application/json' -d '{"action":"buy","symbol":"BTCUSDT","quantity":1}'); [ "$c" = 401 ] && ok "webhook needs auth" || ko "webhook needs auth" "$c"
c=$(code "$B/api/trade-relay/account"); [ "$c" = 401 ] && ok "relay account needs auth" || ko "relay account needs auth" "$c"
c=$(code -X POST "$B/api/webhook/AAAAAAAAAAAAAAAAAAAAAAAAAAAA" -H 'content-type: application/json' -d '{}'); [ "$c" = 404 ] && ok "bad webhook token 404" || ko "bad webhook token 404" "$c"
c=$(code "$B/api/candles?symbol=%3Cscript%3E"); [ "$c" = 400 ] && ok "candles rejects bad symbol" || ko "candles rejects bad symbol" "$c"
c=$(code "$B/api/candles?symbol=BTCUSDT&from_time=abc"); [ "$c" = 400 ] && ok "candles rejects bad time" || ko "candles rejects bad time" "$c"
n=$(curl -s "$B/api/candles?symbol=BTCUSDT&limit=999999999" | python3 -c "import sys,json;print(json.load(sys.stdin).get('count',0))" 2>/dev/null); [ "${n:-0}" -le 10000 ] && ok "candles capped by plan ($n)" || ko "candles capped" "$n"
c=$(code "$B/api/tse-tape?symbol=%3Cscript%3E"); [ "$c" = 400 ] && ok "tse-tape rejects bad symbol" || ko "tse-tape rejects bad symbol" "$c"
c=$(code "$B/api/nope"); [ "$c" = 404 ] && ok "unknown API is JSON 404" || ko "unknown API 404" "$c"
c=$(curl -s -X POST "$B/api/auth/login" -H 'content-type: application/json' -d '{bad'); echo "$c" | grep -q invalid_json && ok "malformed JSON → clean error" || ko "malformed JSON" "$c"
c=$(code -X POST "$B/api/auth/login" -H 'content-type: application/json' -H 'Origin: https://evil.example' -d '{}'); [ "$c" = 403 ] && ok "cross-origin write blocked" || ko "cross-origin write blocked" "$c"
c=$(code -X POST "$B/api/user/plan" -H 'content-type: application/json' -d '{"plan":"ultimate"}'); [ "$c" = 401 ] && ok "plan change needs auth" || ko "plan change needs auth" "$c"
c=$(code "$B/api/admin/users"); [ "$c" = 403 ] && ok "admin API guarded" || ko "admin API guarded" "$c"
c=$(code "$B/api/admin/users?masterKey=x"); [ "$c" = 403 ] && ok "admin key in query refused" || ko "admin key in query" "$c"
for f in server/data/admin_master.key .env package.json server/accounts.js .git/config; do
  b=$(curl -s "$B/$f" | head -c 200); echo "$b" | grep -qiE '^<!doctype html' && ok "/$f not served" || { [ -z "$b" ] && ok "/$f not served" || ko "/$f served" "${b:0:40}"; }
done
c=$(curl -s "$B/api/market-sources" | python3 -c "import sys,json;d=json.load(sys.stdin);print(sum(1 for s in d['sources'] if s['status']=='online' and not s.get('live')))"); [ "$c" = 0 ] && ok "no demo feed claims online" || ko "demo feed online" "$c"
echo "Total: $((pass+fail)) | Passed: $pass | Failed: $fail"
[ $fail -eq 0 ]
