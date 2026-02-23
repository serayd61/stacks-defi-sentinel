#!/usr/bin/env bash
# ============================================================
#  Agentic AI Cluster — VPS Setup Script
#  For Ubuntu 22.04 / 24.04
#  Usage: sudo bash setup-vps.sh
# ============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $*"; }
warn() { echo -e "${YELLOW}[!]${NC} $*"; }
err()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }
info() { echo -e "${CYAN}[→]${NC} $*"; }

echo -e "\n${BOLD}⚡ AGENTIC AI CLUSTER — VPS SETUP${NC}"
echo -e "   Stacks DeFi Sentinel · Ubuntu Edition\n"

# ─── Root check ──────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  err "Run this script as root: sudo bash setup-vps.sh"
fi

# ─── RAM check ───────────────────────────────────────────────
TOTAL_RAM_GB=$(awk '/MemTotal/{printf "%.0f", $2/1024/1024}' /proc/meminfo)
info "Total RAM: ${TOTAL_RAM_GB}GB"

if [[ $TOTAL_RAM_GB -lt 8 ]]; then
  warn "Less than 8GB RAM detected. Using tinyllama instead of phi3:mini."
  MODEL="tinyllama"
else
  MODEL="phi3:mini"
fi
log "Selected model: $MODEL"

# ─── 1. System update ────────────────────────────────────────
info "Updating system..."
apt-get update -qq && apt-get upgrade -y -qq
log "System updated."

# ─── 2. Docker installation ──────────────────────────────────
if command -v docker &>/dev/null; then
  log "Docker is already installed: $(docker --version)"
else
  info "Installing Docker..."
  apt-get install -y -qq ca-certificates curl gnupg lsb-release
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable docker --now
  log "Docker installed."
fi

# ─── 3. Docker Compose v2 check ──────────────────────────────
if docker compose version &>/dev/null; then
  log "Docker Compose v2 is available."
else
  err "Docker Compose v2 not found. Is Docker up to date?"
fi

# ─── 4. Project directory ────────────────────────────────────
PROJECT_DIR="/opt/sentinel-ai-cluster"
info "Project directory: $PROJECT_DIR"
mkdir -p "$PROJECT_DIR"

# Copy from current directory (if script is run from ai-cluster/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$SCRIPT_DIR" != "$PROJECT_DIR" ]]; then
  cp -r "$SCRIPT_DIR"/. "$PROJECT_DIR/"
  log "Files copied to $PROJECT_DIR."
fi

cd "$PROJECT_DIR"

# ─── 5. .env file ────────────────────────────────────────────
if [[ ! -f .env ]]; then
  info "Creating .env file..."
  cat > .env <<EOF
# Agentic AI Cluster — Environment Variables
MODEL=${MODEL}
OLLAMA_URL=http://da-vinci:11434
REDIS_URL=redis://redis-bus:6379
SENTINEL_API=http://host.docker.internal:3000

# Agent Settings
WHALE_THRESHOLD_STX=10000
POLL_INTERVAL_SATOSHI=30
POLL_INTERVAL_NAKAMOTO=60
POLL_INTERVAL_SZABO=120
REPORT_HOUR=7
EOF
  log ".env created. Edit if needed: nano $PROJECT_DIR/.env"
else
  log ".env already exists."
fi

# ─── 6. Firewall (UFW) ────────────────────────────────────────
if command -v ufw &>/dev/null; then
  info "Adding firewall rules..."
  ufw allow 8080/tcp comment "AI Cluster Dashboard" 2>/dev/null || true
  ufw allow 9000/tcp comment "Orchestrator API"     2>/dev/null || true
  # Ollama local access only — do not expose externally!
  log "Firewall: ports 8080 (dashboard) and 9000 (orchestrator) opened."
  warn "Ollama port (11434) intentionally kept closed to external access."
fi

# ─── 7. Write model selection to docker-compose.yml ──────────
info "Updating Docker Compose model: $MODEL"
sed -i "s/phi3:mini/${MODEL}/g" "$PROJECT_DIR/docker-compose.yml" 2>/dev/null || true

# ─── 8. Container build & start ───────────────────────────────
info "Building containers (first run may take ~5 min)..."
docker compose build --no-cache

info "Starting cluster..."
docker compose up -d

# ─── 9. Model download wait ──────────────────────────────────
info "Downloading LLM model: $MODEL (duration depends on your internet speed)..."
sleep 10
docker compose logs model-init --no-log-prefix 2>/dev/null | tail -5 || true

# ─── 10. Health check ────────────────────────────────────────
info "Running cluster health check..."
sleep 15

HEALTH=$(curl -sf http://localhost:9000/api/health 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  log "Orchestrator is healthy."
else
  warn "Orchestrator is not ready yet, wait a few minutes."
fi

# ─── Summary ─────────────────────────────────────────────────
SERVER_IP=$(curl -sf https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  SETUP COMPLETE${NC}"
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo ""
echo -e "  Dashboard   →  http://${SERVER_IP}:8080"
echo -e "  API         →  http://${SERVER_IP}:9000/api/status"
echo -e "  Health      →  http://${SERVER_IP}:9000/api/health"
echo ""
echo -e "  ${CYAN}View logs:${NC}"
echo -e "  docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
echo ""
echo -e "  ${CYAN}Send commands to agents:${NC}"
echo -e '  curl -X POST http://localhost:9000/api/command \'
echo -e '    -H "Content-Type: application/json" \'
echo -e '    -d '"'"'{"command":"scan_whales"}'"'"
echo ""
echo -e "  ${YELLOW}Model:${NC} $MODEL  ${YELLOW}|  RAM:${NC} ${TOTAL_RAM_GB}GB"
echo ""
