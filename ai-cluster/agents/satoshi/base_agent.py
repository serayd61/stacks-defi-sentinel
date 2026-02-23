"""
Base Agent — Tüm agentlar bu sınıfı miras alır.
Ollama LLM iletişimi + Redis pub/sub + Sentinel API ortak katmanı.
"""
import os
import json
import time
import logging
import requests
import redis

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s — %(message)s"
)


class BaseAgent:
    def __init__(self):
        self.name        = os.getenv("AGENT_NAME", "agent")
        self.role        = os.getenv("AGENT_ROLE", "generic")
        self.ollama_url  = os.getenv("OLLAMA_URL", "http://da-vinci:11434")
        self.sentinel_api = os.getenv("SENTINEL_API", "http://sentinel-api:3000")
        self.model       = os.getenv("MODEL", "phi3:mini")
        self.log         = logging.getLogger(self.name.upper())

        redis_url = os.getenv("REDIS_URL", "redis://redis-bus:6379")
        self.redis = redis.from_url(redis_url, decode_responses=True)
        self.pubsub = self.redis.pubsub()

        self.log.info(f"Agent başlatıldı | rol={self.role} | model={self.model}")

    # ─── LLM ──────────────────────────────────────────────────
    def think(self, prompt: str, system: str = "") -> str:
        """Ollama'ya istek at, yanıt döndür."""
        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 512}
        }
        try:
            r = requests.post(
                f"{self.ollama_url}/api/generate",
                json=payload, timeout=60
            )
            r.raise_for_status()
            return r.json().get("response", "").strip()
        except Exception as e:
            self.log.error(f"LLM hatası: {e}")
            return ""

    # ─── Redis Mesajlaşma ──────────────────────────────────────
    def publish(self, channel: str, data: dict):
        data["from"] = self.name
        data["ts"]   = int(time.time())
        self.redis.publish(channel, json.dumps(data))
        self.log.debug(f"Yayınlandı → {channel}")

    def subscribe(self, *channels):
        self.pubsub.subscribe(*channels)
        self.log.info(f"Dinleniyor: {list(channels)}")

    def listen(self):
        for msg in self.pubsub.listen():
            if msg["type"] == "message":
                try:
                    yield json.loads(msg["data"])
                except json.JSONDecodeError:
                    pass

    # ─── Hiro API (direct) ────────────────────────────────────
    HIRO_API = "https://api.hiro.so"

    def get_recent_txs(self, limit: int = 20) -> list:
        """Hiro API'den son Stacks işlemlerini çek."""
        try:
            r = requests.get(
                f"{self.HIRO_API}/extended/v1/tx",
                params={"limit": min(limit, 50), "order": "desc", "order_by": "block_height"},
                timeout=20
            )
            return r.json().get("results", []) if r.ok else []
        except Exception as e:
            self.log.error(f"Hiro transactions hatası: {e}")
            return []

    def get_whale_alerts(self) -> list:
        """Hiro API'den büyük STX transferlerini çek."""
        whale_threshold_stx = int(os.getenv("WHALE_THRESHOLD_STX", "1000"))
        try:
            r = requests.get(
                f"{self.HIRO_API}/extended/v1/tx",
                params={"type": "token_transfer", "limit": 50, "order": "desc", "order_by": "block_height"},
                timeout=20
            )
            if not r.ok:
                return []
            txs = r.json().get("results", [])
            whales = []
            for tx in txs:
                tt = tx.get("token_transfer", {})
                amount_micro = int(tt.get("amount", 0))
                amount_stx = amount_micro / 1_000_000
                if amount_stx >= whale_threshold_stx:
                    whales.append({
                        "txid":            tx.get("tx_id", ""),
                        "amount":          round(amount_stx),
                        "sender":          tx.get("sender_address", ""),
                        "receiver":        tt.get("recipient_address", ""),
                        "timestamp":       tx.get("burn_block_time_iso", ""),
                        "sender_tx_count": 0,
                    })
            return whales
        except Exception as e:
            self.log.error(f"Hiro whale hatası: {e}")
            return []

    def get_dex_data(self) -> dict:
        """CoinGecko'dan STX fiyatı + DEX özeti çek."""
        try:
            r = requests.get(
                "https://api.coingecko.com/api/v3/simple/price",
                params={"ids": "blockstack", "vs_currencies": "usd", "include_24hr_change": "true"},
                timeout=15
            )
            if r.ok:
                cg = r.json().get("blockstack", {})
                return {
                    "stx_price_usd":  cg.get("usd", 0),
                    "change_24h_pct": cg.get("usd_24h_change", 0),
                    "pools": [
                        {"name": "STX/USDA", "exchange": "Velar"},
                        {"name": "STX/xBTC", "exchange": "ALEX"},
                        {"name": "STX/USDA", "exchange": "Arkadiko"},
                    ],
                    "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                }
            return {}
        except Exception as e:
            self.log.error(f"CoinGecko DEX hatası: {e}")
            return {}

    def post_insight(self, insight: dict):
        """AI analiz sonucunu Sentinel'e kaydet."""
        try:
            requests.post(
                f"{self.sentinel_api}/api/ai-insights",
                json=insight, timeout=10
            )
        except Exception as e:
            self.log.error(f"Insight gönderme hatası: {e}")

    # ─── Storage ───────────────────────────────────────────────
    def cache_set(self, key: str, value, ttl: int = 3600):
        self.redis.setex(f"{self.name}:{key}", ttl, json.dumps(value))

    def cache_get(self, key: str):
        raw = self.redis.get(f"{self.name}:{key}")
        return json.loads(raw) if raw else None

    def run(self):
        raise NotImplementedError("Her agent kendi run() metodunu tanımlamalı.")
