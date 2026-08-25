#!/usr/bin/env bash
#
# Deploy script for the video2text API backend.
#
# Model: system Python + systemd (NO Docker). Idempotent — safe to re-run on
# updates after `git pull` (just run `sudo bash setup.sh` again).
#
# Must be run as root (e.g. `sudo bash setup.sh`) so it can:
#   * install the Python deps into the service user's ~/.local (--user)
#   * install / enable the systemd unit
#
# The service runs as the `ubuntu` user; its ExecStart/ExecStartPre use the
# absolute path /home/ubuntu/.local/bin/{uvicorn,alembic}. Therefore the pip
# install below MUST happen as the `ubuntu` user, not as root, or the binaries
# would land in /root/.local and the service would fail to start.
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVICE_USER="ubuntu"
SERVICE_FILE="video2text-api.service"
SYSTEMD_DIR="/etc/systemd/system"
SYSTEMD_UNIT="${SYSTEMD_DIR}/${SERVICE_FILE}"

# Wrapper around apt-get that neutralizes the broken `APT::Update::Post-Invoke*`
# hooks. On hosts where `python3` is a non-system (e.g. deadsnakes) interpreter,
# /usr/lib/cnf-update-db imports apt_pkg and crashes, making `apt-get update`
# exit non-zero and abort this script. Clearing the hook lets apt proceed.
run_apt() {
  apt-get -o APT::Update::Post-Invoke= -o APT::Update::Post-Invoke-Success= "$@"
}

echo ">> [setup] working dir: ${SCRIPT_DIR}"

# ---- 0. Sanity checks -----------------------------------------------------
if [[ "${EUID}" -ne 0 ]]; then
  echo "!! This script must be run as root (use: sudo bash setup.sh)" >&2
  exit 1
fi

if ! id -u "${SERVICE_USER}" >/dev/null 2>&1; then
  echo "!! Service user '${SERVICE_USER}' does not exist. Create it first." >&2
  exit 1
fi

# .env must already exist (built manually from .env.example, never in git).
if [[ ! -f "${SCRIPT_DIR}/.env" ]]; then
  echo "!! ${SCRIPT_DIR}/.env not found." >&2
  echo "!! Copy .env.example to .env and fill in real secrets, then re-run." >&2
  exit 1
fi

# ---- 1. Ensure pip exists for the service user's python -------------------
# Images may ship without pip, and when `python3` is a deadsnakes / non-system
# interpreter, `apt-get install python3-pip` only provisions the *system* python.
# So bootstrap pip with ensurepip for the actual interpreter first; fall back to
# apt only when ensurepip is unavailable.
if ! sudo -u "${SERVICE_USER}" python3 -m pip --version >/dev/null 2>&1; then
  echo ">> [setup] pip missing for '${SERVICE_USER}' python; bootstrapping via ensurepip..."
  if ! sudo -u "${SERVICE_USER}" python3 -m ensurepip --user >/dev/null 2>&1; then
    echo ">> [setup] ensurepip unavailable — installing python3-pip via apt..."
    run_apt update
    run_apt install -y python3-pip
  fi
fi

# ---- 2. Ensure build toolchain for possible source builds -----------------
# A C toolchain + Python headers are only needed if pip must build a wheel from
# source (e.g. a pin has no prebuilt wheel for the running Python). Idempotent.
if ! command -v cc >/dev/null 2>&1 || ! sudo -u "${SERVICE_USER}" python3 -c "import sysconfig,os;sys.exit(0 if os.path.exists(sysconfig.get_path('include')+'/Python.h') else 1)" 2>/dev/null; then
  echo ">> [setup] Installing build toolchain (build-essential, python3-dev) for source builds..."
  run_apt update
  run_apt install -y build-essential python3-dev
fi

# ---- 3. Install Python deps as the service user (--user) ------------------
echo ">> [setup] Installing Python dependencies for '${SERVICE_USER}' (--user)..."
# --break-system-packages: the system Python is PEP 668 "externally managed", which
# blocks pip even for --user installs. We still install only into the user's ~/.local,
# so the system Python is untouched (no venv/conda per the deployment runbook).
# PYO3_USE_ABI3_FORWARD_COMPATIBILITY: some native deps (e.g. pydantic-core's PyO3
# 0.22) cap their supported Python below the deployed 3.14; building against the stable
# ABI lets them compile on newer interpreters. Harmless where not needed.
sudo -u "${SERVICE_USER}" env PYO3_USE_ABI3_FORWARD_COMPATIBILITY=1 \
  python3 -m pip install --user --break-system-packages -r "${SCRIPT_DIR}/requirements.txt"

# ---- 3. Install the systemd unit ------------------------------------------
echo ">> [setup] Installing systemd unit: ${SYSTEMD_UNIT}"
cp "${SCRIPT_DIR}/${SERVICE_FILE}" "${SYSTEMD_UNIT}"
chmod 644 "${SYSTEMD_UNIT}"

# ---- 4. Reload, enable, and (re)start -------------------------------------
systemctl daemon-reload
systemctl enable video2text-api

if systemctl is-active --quiet video2text-api; then
  echo ">> [setup] Restarting video2text-api..."
  systemctl restart video2text-api
else
  echo ">> [setup] Starting video2text-api..."
  systemctl start video2text-api
fi

# ---- 5. Install & start Caddy (reverse proxy + TLS) ----------------------
# Caddy terminates 443 and reverse-proxies to the local uvicorn (127.0.0.1:8000),
# auto-issuing/renewing Let's Encrypt certs (see runbook §14.6.2 stage 5).
# Domain is overridable (prod default: api.video2text.dpdns.org). A cert
# provisioning failure (e.g. DNS not yet pointed at this host) must NOT abort the
# deploy — the backend above is the critical piece; caddy keeps retrying certs.
CADDY_DOMAIN="${CADDY_DOMAIN:-api.video2text.dpdns.org}"
echo ">> [setup] Installing Caddy (reverse proxy for https://${CADDY_DOMAIN})..."
run_apt install -y caddy

echo ">> [setup] Writing Caddyfile for ${CADDY_DOMAIN}..."
mkdir -p /etc/caddy
cat > /etc/caddy/Caddyfile <<EOF
${CADDY_DOMAIN} {
    encode gzip
    reverse_proxy 127.0.0.1:8000
}
EOF

echo ">> [setup] Enabling & starting caddy..."
systemctl enable caddy
systemctl restart caddy || echo ">> [setup] WARN: caddy not fully healthy (check TLS/cert); backend still serving on :8000"

echo ">> [setup] Done. Current status:"
systemctl status video2text-api --no-pager || true
echo "--- caddy ---"
systemctl is-active caddy 2>/dev/null || echo "caddy: inactive"
