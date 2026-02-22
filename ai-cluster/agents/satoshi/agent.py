"""
SATOSHI — Whale Takibi & Pattern Analizi Ajanı
────────────────────────────────────────────────
Görev:
  • Her 30 sn'de Sentinel API'dan büyük işlemleri çeker
  • LLM ile davranış paterni analizi yapar
  • Anormal durum tespit edince Redis'e yayın yapar
  • Nakamoto ve Szabo'yu tetikler
"""
import time
import os
import schedule
from base_agent import BaseAgent

WHALE_THRESHOLD = int(os.getenv("WHALE_THRESHOLD_STX", "10000"))
POLL_INTERVAL   = int(os.getenv("POLL_INTERVAL", "30"))

SYSTEM_PROMPT = """
Sen bir DeFi whale analisti yapay zeka ajanısın.
Stacks blockchain'deki büyük STX transferlerini inceler,
geçmiş işlem paternlerine bakarak pump/dump sinyali,
likidite çekilmesi veya balina biriktirme gibi davranışları tespit edersin.
Yanıtlarını JSON formatında ver.
"""


class SatoshiAgent(BaseAgent):

    def __init__(self):
        super().__init__()
        self.seen_txids = set()
        self.subscribe("szabo:security_alert", "orchestrator:command")

    def analyze_whale(self, tx: dict) -> dict:
        prompt = f"""
Aşağıdaki büyük STX transferini analiz et:

İşlem ID  : {tx.get('txid', 'bilinmiyor')}
Miktar    : {tx.get('amount', 0)} STX
Gönderen  : {tx.get('sender', '?')}
Alıcı     : {tx.get('receiver', '?')}
Zaman     : {tx.get('timestamp', '?')}
Geçmiş TX : {tx.get('sender_tx_count', 0)} işlem

Şu soruları yanıtla (JSON):
{{
  "risk_level": "low|medium|high",
  "pattern": "accumulation|distribution|transfer|suspicious",
  "prediction": "kısa açıklama",
  "action_needed": true/false
}}
"""
        response = self.think(prompt, SYSTEM_PROMPT)
        try:
            import json
            # LLM yanıtından JSON bloğunu bul
            start = response.find("{")
            end   = response.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response[start:end])
        except Exception:
            pass
        return {"risk_level": "low", "pattern": "transfer",
                "prediction": response[:200], "action_needed": False}

    def process_whales(self):
        txs = self.get_whale_alerts()
        if not txs:
            self.log.info("Yeni whale hareketi yok.")
            return

        for tx in txs:
            txid = tx.get("txid", "")
            amount = tx.get("amount", 0)

            if txid in self.seen_txids:
                continue
            if amount < WHALE_THRESHOLD:
                continue

            self.seen_txids.add(txid)
            self.log.info(f"Whale tespit edildi: {amount} STX | {txid[:12]}...")

            analysis = self.analyze_whale(tx)
            self.log.info(f"Analiz → risk={analysis['risk_level']} pattern={analysis['pattern']}")

            insight = {
                "agent": self.name,
                "type": "whale_analysis",
                "txid": txid,
                "amount": amount,
                "analysis": analysis
            }
            self.post_insight(insight)
            self.cache_set(f"whale:{txid}", insight)

            # Yüksek riskli → diğer agentları uyar
            if analysis.get("risk_level") == "high" or analysis.get("action_needed"):
                self.publish("satoshi:whale_alert", {
                    "txid": txid,
                    "amount": amount,
                    "analysis": analysis
                })
                self.log.warning(f"Yüksek risk yayınlandı → {txid[:12]}")

        # Bellek yönetimi
        if len(self.seen_txids) > 1000:
            self.seen_txids = set(list(self.seen_txids)[-500:])

    def handle_messages(self):
        """Redis'ten gelen mesajları işle (non-blocking)."""
        msg = self.pubsub.get_message(timeout=0.1)
        if msg and msg["type"] == "message":
            import json
            try:
                data = json.loads(msg["data"])
                if data.get("command") == "scan_whales":
                    self.log.info("Orchestrator'dan tarama komutu alındı.")
                    self.process_whales()
            except Exception:
                pass

    def run(self):
        self.log.info("SATOSHI aktif — whale takibi başlıyor.")
        schedule.every(POLL_INTERVAL).seconds.do(self.process_whales)

        # İlk çalışma
        self.process_whales()

        while True:
            schedule.run_pending()
            self.handle_messages()
            time.sleep(1)


if __name__ == "__main__":
    agent = SatoshiAgent()
    agent.run()
