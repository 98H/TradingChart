#!/usr/bin/env bash
# deploy/activate_domain.sh — put Chartivia live on https://chartivia.com
# Prerequisites (owner actions):
#   1. chartivia.com added to Cloudflare (free plan) and the registrar's
#      nameservers switched to the two Cloudflare nameservers.
#   2. `cloudflared tunnel login` run once on this server (opens a browser link)
#      OR a tunnel token exported as CF_TUNNEL_TOKEN.
# What this does: named tunnel → DNS for apex + www → systemd unit →
# binds the app to 127.0.0.1 (no direct :8088 exposure) → verifies HTTPS.
set -euo pipefail
NAME=chartivia
APP=/root/TradingChart
UNIT=/etc/systemd/system/chartivia-tunnel.service

if [ -n "${CF_TUNNEL_TOKEN:-}" ]; then
  # Token mode (tunnel + public hostnames configured in the Cloudflare dashboard)
  cat > "$UNIT" <<EOF
[Unit]
Description=Chartivia HTTPS tunnel (Cloudflare) for chartivia.com
After=network-online.target tradingchart.service
Wants=network-online.target
[Service]
Type=simple
ExecStart=/usr/local/bin/cloudflared --no-autoupdate tunnel run --token ${CF_TUNNEL_TOKEN}
Restart=always
RestartSec=5
MemoryMax=150M
[Install]
WantedBy=multi-user.target
EOF
  chmod 600 "$UNIT"
else
  [ -f /root/.cloudflared/cert.pem ] || { echo "Run: cloudflared tunnel login   (then re-run this script)"; exit 1; }
  cloudflared tunnel list | grep -q " $NAME " || cloudflared tunnel create "$NAME"
  TID=$(cloudflared tunnel list | awk -v n="$NAME" '$2==n{print $1}')
  mkdir -p /etc/cloudflared
  sed "s/<TUNNEL_ID>/$TID/g" "$APP/deploy/cloudflared-chartivia.yml" > /etc/cloudflared/chartivia.yml
  cloudflared tunnel route dns -f "$NAME" chartivia.com
  cloudflared tunnel route dns -f "$NAME" www.chartivia.com
  cp "$APP/deploy/chartivia-tunnel.service" "$UNIT"
fi

systemctl daemon-reload
systemctl enable --now chartivia-tunnel
# App listens on loopback only from now on.
mkdir -p "$APP/server/data"
grep -q '^HOST=' "$APP/server/data/env" 2>/dev/null || echo 'HOST=127.0.0.1' >> "$APP/server/data/env"
chmod 600 "$APP/server/data/env"
systemctl restart tradingchart
sleep 8
for u in https://chartivia.com/ https://chartivia.com/chart https://chartivia.com/api/health https://www.chartivia.com/; do
  printf '%-40s %s\n' "$u" "$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$u")"
done
curl -sI https://chartivia.com/ | grep -iE 'strict-transport|content-security' | cut -c1-80
echo "Direct :8088 from outside must now fail:"; ss -tlnp | grep ':8088 '
