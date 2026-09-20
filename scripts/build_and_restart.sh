#!/bin/bash
# scripts/build_and_restart.sh — build client bundle and restart TradingChart service
set -e
cd /root/TradingChart
./node_modules/.bin/vite build > /tmp/vite_build.log 2>&1
echo "BUILD_EXIT=$?"
systemctl restart tradingchart
sleep 3
curl -s -o /dev/null -w "SVC_HTTP=%{http_code}\n" http://127.0.0.1:8088/
tail -3 /tmp/vite_build.log