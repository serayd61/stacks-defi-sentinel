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

    # ─── Sentinel API ──────────────────────────────────────────
    def get_recent_txs(self, limit: int = 20) -> list:
        try:
            r = requests.get(
                f"{self.sentinel_api}/api/transactions",
                params={"limit": limit}, timeout=10
            )
            return r.json() if r.ok else []
        except Exception as e:
            self.log.error(f"API hatası (transactions): {e}")
            return []

    def get_whale_alerts(self) -> list:
        try:
            r = requests.get(
                f"{self.sentinel_api}/api/whale-alerts", timeout=10
            )
            return r.json() if r.ok else []
        except Exception as e:
            self.log.error(f"API hatası (whale-alerts): {e}")
            return []

    def get_dex_data(self) -> dict:
        try:
            r = requests.get(
                f"{self.sentinel_api}/api/dex", timeout=10
            )
            return r.json() if r.ok else {}
        except Exception as e:
            self.log.error(f"API hatası (dex): {e}")
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
