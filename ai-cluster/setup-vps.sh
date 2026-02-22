#!/usr/bin/env bash
# ============================================================
#  Agentic AI Cluster — VPS Kurulum Scripti
#  Ubuntu 22.04 / 24.04 için
#  Kullanım: sudo bash setup-vps.sh
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

# ─── Root kontrolü ────────────────────────────────────────────
if [[ $EUID -ne 0 ]]; then
  err "Bu scripti root olarak çalıştır: sudo bash setup-vps.sh"
fi

# ─── RAM kontrolü ─────────────────────────────────────────────
TOTAL_RAM_GB=$(awk '/MemTotal/{printf "%.0f", $2/1024/1024}' /proc/meminfo)
info "Toplam RAM: ${TOTAL_RAM_GB}GB"

if [[ $TOTAL_RAM_GB -lt 8 ]]; then
  warn "8GB'tan az RAM tespit edildi. phi3:mini yerine tinyllama kullanılacak."
  MODEL="tinyllama"
else
  MODEL="phi3:mini"
fi
log "Seçilen model: $MODEL"

# ─── 1. Sistem güncellemesi ───────────────────────────────────
info "Sistem güncelleniyor..."
apt-get update -qq && apt-get upgrade -y -qq
log "Sistem güncellendi."

# ─── 2. Docker kurulumu ───────────────────────────────────────
if command -v docker &>/dev/null; then
  log "Docker zaten kurulu: $(docker --version)"
else
  info "Docker kuruluyor..."
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
  log "Docker kuruldu."
fi

# ─── 3. Docker Compose v2 kontrolü ───────────────────────────
if docker compose version &>/dev/null; then
  log "Docker Compose v2 mevcut."
else
  err "Docker Compose v2 bulunamadı. Docker güncel mi?"
fi

# ─── 4. Proje dizini ──────────────────────────────────────────
PROJECT_DIR="/opt/sentinel-ai-cluster"
info "Proje dizini: $PROJECT_DIR"
mkdir -p "$PROJECT_DIR"

# Mevcut dizinden kopyala (script ai-cluster/ içinden çalıştırılıyorsa)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ "$SCRIPT_DIR" != "$PROJECT_DIR" ]]; then
  cp -r "$SCRIPT_DIR"/. "$PROJECT_DIR/"
  log "Dosyalar $PROJECT_DIR'e kopyalandı."
fi

cd "$PROJECT_DIR"

# ─── 5. .env dosyası ──────────────────────────────────────────
if [[ ! -f .env ]]; then
  info ".env dosyası oluşturuluyor..."
  cat > .env <<EOF
# Agentic AI Cluster — Ortam Değişkenleri
MODEL=${MODEL}
OLLAMA_URL=http://da-vinci:11434
REDIS_URL=redis://redis-bus:6379
SENTINEL_API=http://host.docker.internal:3000

# Agent Ayarları
WHALE_THRESHOLD_STX=10000
POLL_INTERVAL_SATOSHI=30
POLL_INTERVAL_NAKAMOTO=60
POLL_INTERVAL_SZABO=120
REPORT_HOUR=7
EOF
  log ".env oluşturuldu. Gerekirse düzenle: nano $PROJECT_DIR/.env"
else
  log ".env zaten mevcut."
fi

# ─── 6. Firewall (UFW) ────────────────────────────────────────
if command -v ufw &>/dev/null; then
  info "Firewall kuralları ekleniyor..."
  ufw allow 8080/tcp comment "AI Cluster Dashboard" 2>/dev/null || true
  ufw allow 9000/tcp comment "Orchestrator API"     2>/dev/null || true
  # Ollama sadece lokal erişim — dışarıya açma!
  log "Firewall: 8080 (dashboard) ve 9000 (orchestrator) açıldı."
  warn "Ollama portu (11434) intentionally dışarıya kapalı tutuldu."
fi

# ─── 7. Model seçimini docker-compose.yml'e yaz ───────────────
info "Docker Compose modelini güncelleniyor: $MODEL"
sed -i "s/phi3:mini/${MODEL}/g" "$PROJECT_DIR/docker-compose.yml" 2>/dev/null || true

# ─── 8. Container build & start ───────────────────────────────
info "Container'lar build ediliyor (ilk seferde ~5 dk sürebilir)..."
docker compose build --no-cache

info "Cluster başlatılıyor..."
docker compose up -d

# ─── 9. Model indirme bekleme ─────────────────────────────────
info "LLM modeli indiriliyor: $MODEL (internet hızınıza göre değişir)..."
sleep 10
docker compose logs model-init --no-log-prefix 2>/dev/null | tail -5 || true

# ─── 10. Sağlık kontrolü ─────────────────────────────────────
info "Cluster sağlık kontrolü yapılıyor..."
sleep 15

HEALTH=$(curl -sf http://localhost:9000/api/health 2>/dev/null || echo "")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  log "Orchestrator sağlıklı."
else
  warn "Orchestrator henüz hazır değil, birkaç dakika bekle."
fi

# ─── Özet ─────────────────────────────────────────────────────
SERVER_IP=$(curl -sf https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo -e "${GREEN}  KURULUM TAMAMLANDI${NC}"
echo -e "${BOLD}══════════════════════════════════════════${NC}"
echo ""
echo -e "  Dashboard   →  http://${SERVER_IP}:8080"
echo -e "  API         →  http://${SERVER_IP}:9000/api/status"
echo -e "  Health      →  http://${SERVER_IP}:9000/api/health"
echo ""
echo -e "  ${CYAN}Logları görüntüle:${NC}"
echo -e "  docker compose -f $PROJECT_DIR/docker-compose.yml logs -f"
echo ""
echo -e "  ${CYAN}Agentlara komut gönder:${NC}"
echo -e '  curl -X POST http://localhost:9000/api/command \'
echo -e '    -H "Content-Type: application/json" \'
echo -e '    -d '"'"'{"command":"scan_whales"}'"'"
echo ""
echo -e "  ${YELLOW}Model:${NC} $MODEL  ${YELLOW}|  RAM:${NC} ${TOTAL_RAM_GB}GB"
echo ""
