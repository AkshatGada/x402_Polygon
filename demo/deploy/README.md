# Deploy facilitator on VPS (Docker Compose + Caddy)

This guide shows how to deploy the facilitator on a Linux VPS (Ubuntu 22.04+) using Docker Compose and Caddy for automatic TLS.

Prerequisites on the VPS
- Docker and Docker Compose (v2+) installed
- Domain name (e.g. `example.com`) pointed to the VPS public IP (A/AAAA)
- GitHub Container Registry access to pull the image (if private): create a PAT with `package:read` or use a machine account

1) Clone repo (or copy these files)

```bash
cd /srv
git clone https://github.com/<your-org>/x402_polygon.git
cd x402_polygon/demo/deploy
```

2) Prepare environment file `/srv/x402_polygon/demo/deploy/.env`

```
FACILITATOR_PRIVATE_KEY="<YOUR_FACILITATOR_PRIVATE_KEY>"
AMOY_RPC_URL="https://your-amoy-rpc"
AMOY_USDC_ADDRESS="0x..."
REAL_SETTLE=true
# If GHCR is private, add credentials for docker login or use pull-through cache
```

3) (Optional) Authenticate to GHCR if image is private

```bash
echo "<PAT>" | docker login ghcr.io -u <github-username> --password-stdin
```

4) Start stack

```bash
docker compose -f docker-compose.facilitator.prod.yml up -d
```

Caddy will obtain TLS for the site configured in `Caddyfile`. Edit `Caddyfile` to replace `example.com` with your domain before starting.

5) Create systemd service to manage the compose stack

Create `/etc/systemd/system/facilitator-stack.service` with the following content:

```
[Unit]
Description=Facilitator Docker Compose stack
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=/srv/x402_polygon/demo/deploy
EnvironmentFile=/srv/x402_polygon/demo/deploy/.env
ExecStart=/usr/bin/docker compose -f docker-compose.facilitator.prod.yml up -d
ExecStop=/usr/bin/docker compose -f docker-compose.facilitator.prod.yml down
TimeoutStartSec=300

[Install]
WantedBy=multi-user.target
```

Then enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable facilitator-stack.service
sudo systemctl start facilitator-stack.service
```

6) Firewall (UFW) - allow HTTP/HTTPS

```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

7) Verify

```bash
# Check caddy and facilitator logs
docker compose -f docker-compose.facilitator.prod.yml logs caddy --tail=50
docker compose -f docker-compose.facilitator.prod.yml logs facilitator --tail=50

# Health endpoint
curl -I https://example.com/healthz
```

Notes
- Caddy stores TLS certs in the `caddy_data` volume; back up `/var/lib/docker/volumes/<project>_caddy_data/_data` if needed.
- Keep `FACILITATOR_PRIVATE_KEY` secure; prefer a vault or environment injection via the host system.

If you want, I can create the systemd unit file in this repo and commit it. Also I can add a small script to perform docker login for GHCR if needed. 