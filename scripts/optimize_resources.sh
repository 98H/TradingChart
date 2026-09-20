#!/bin/bash
# scripts/optimize_resources.sh — Safe, conservative VPS resource optimization.
# Never touches project files or running services; only clears reclaimable caches
# and prunes oversized logs. Prints before/after metrics as evidence.
set -u

echo "════ TradingChart Safe Resource Optimization ════"
echo "--- BEFORE ---"
free -m | head -2
echo "disk: $(df -h / | awk 'NR==2{print $4" free ("$5" used)"}')"

# 0. Guard: confirm critical peer services are healthy before AND after.
#    This is the "do no harm to other projects" contract: if optimization ever
#    disturbed a peer, the pre/post comparison makes it visible immediately.
PEERS="tradingchart 9router backend frontend telegram-bot hermes-gateway hermes-serve nexus-agent-graph nexus-quant-os nexus-cloudflared nexus-chrome-cdp hysteria-server tailscaled warp-svc fail2ban"
health() {
  for s in $PEERS; do
    printf '  %-22s %s\n' "$s" "$(systemctl is-active $s 2>/dev/null || echo n/a)"
  done
}
echo "--- peer service health (pre) ---"; health

# 1. npm cache (safe: only package tarball cache, not any project's node_modules)
if command -v npm >/dev/null 2>&1; then
  npm cache clean --force >/dev/null 2>&1 && echo "✓ npm cache cleaned"
fi

# 2. apt cache (safe: only downloaded .deb archives)
apt-get clean >/dev/null 2>&1 && echo "✓ apt cache cleaned"

# 3. systemd journal — keep a bounded 100MB (never remove the active journal)
journalctl --vacuum-size=100M >/dev/null 2>&1 && echo "✓ journal vacuumed to 100M"

# 4. Drop ONLY clean page cache / dentries / inodes (the kernel's own reclaimable
#    memory; never touches anonymous memory used by running processes).
sync
echo 1 > /proc/sys/vm/drop_caches 2>/dev/null && echo "✓ reclaimable page cache dropped"

# 5. Remove stale QA temp artifacts from /tmp only (never project files)
find /tmp -maxdepth 1 -type f \( -name 'vite_build*.log' -o -name 'cycle*.log' -o -name 'final*.log' -o -name 'dw_check.log' -o -name 'i18n_final.log' \) -mtime +1 -delete 2>/dev/null || true

# 6. System log hygiene. /var/log is group-writable by syslog, which makes
#    logrotate refuse to rotate unless the config names the target user/group —
#    without that the weekly job fails silently and syslog grows unbounded
#    (observed at 144MB). Rotate now and verify the config no longer errors.
if ! logrotate -d /etc/logrotate.conf 2>&1 | grep -q "insecure permissions"; then
  logrotate -f /etc/logrotate.d/rsyslog >/dev/null 2>&1 && echo "✓ system logs rotated"
else
  echo "! logrotate config still reports insecure permissions — inspect /etc/logrotate.d/rsyslog"
fi
# Compress any uncompressed rotated log left behind (keeps disk bounded).
for f in /var/log/syslog.1 /var/log/kern.log.1 /var/log/auth.log.1 /var/log/user.log.1 /var/log/cron.log.1; do
  [ -f "$f" ] && gzip -f "$f" 2>/dev/null
done
find /var/log -maxdepth 1 -name '*.gz' -mtime +14 -delete 2>/dev/null || true
echo "✓ rotated logs older than 14 days pruned"

echo "--- peer service health (post) ---"; health
echo "--- AFTER ---"
free -m | head -2
echo "disk: $(df -h / | awk 'NR==2{print $4" free ("$5" used)"}')"
# The peer health block above is the safety proof: any 'failed'/'inactive' line
# means STOP and investigate before trusting this run.

# 6. Verify every product surface still answers HTTP 200 after optimization
echo "--- endpoint verification ---"
for u in http://127.0.0.1:8088/ http://127.0.0.1:8088/api/health "http://127.0.0.1:8088/api/candles?symbol=BTCUSDT&timeframe=15&limit=5" http://127.0.0.1:8095/; do
  printf '  %-58s %s\n' "$u" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "$u" || echo TIMEOUT)"
done
echo "════ done ════"