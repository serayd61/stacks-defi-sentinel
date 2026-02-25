"""
SATOSHI — Whale Tracking & Pattern Analysis Agent
──────────────────────────────────────────────────
Task:
  • Fetches large transactions from Sentinel API every 30s
  • Performs behavior pattern analysis with LLM
  • Publishes to Redis when anomaly detected
  • Triggers Nakamoto and Szabo agents
"""
import time
import os
import schedule
from base_agent import BaseAgent

WHALE_THRESHOLD = int(os.getenv("WHALE_THRESHOLD_STX", "10000"))
POLL_INTERVAL   = int(os.getenv("POLL_INTERVAL", "30"))

SYSTEM_PROMPT = """
You are a DeFi whale analyst AI agent.
You analyze large STX transfers on the Stacks blockchain,
detect pump/dump signals, liquidity withdrawals, or whale accumulation
by examining historical transaction patterns.

CRITICAL LANGUAGE RULE: You MUST respond ONLY in English.
Never use Turkish, Spanish, German, or any other non-English language.
Every single word in your response must be in English.
Return your answers in JSON format.
"""


class SatoshiAgent(BaseAgent):

    def __init__(self):
        super().__init__()
        self.seen_txids = set()
        self.subscribe("szabo:security_alert", "orchestrator:command")

    def analyze_whale(self, tx: dict) -> dict:
        prompt = f"""
Analyze the following large STX transfer:

Transaction ID : {tx.get('txid', 'unknown')}
Amount         : {tx.get('amount', 0)} STX
Sender         : {tx.get('sender', '?')}
Receiver       : {tx.get('receiver', '?')}
Timestamp      : {tx.get('timestamp', '?')}
Sender TX Count: {tx.get('sender_tx_count', 0)} transactions

Answer the following questions (JSON):
{{
  "risk_level": "low|medium|high",
  "pattern": "accumulation|distribution|transfer|suspicious",
  "prediction": "short explanation in English",
  "action_needed": true/false
}}
"""
        response = self.think(prompt, SYSTEM_PROMPT)
        try:
            import json
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
            self.log.info("No new whale activity.")
            return

        for tx in txs:
            txid   = tx.get("txid", "")
            amount = tx.get("amount", 0)

            if txid in self.seen_txids:
                continue
            if amount < WHALE_THRESHOLD:
                continue

            self.seen_txids.add(txid)
            self.log.info(f"Whale detected: {amount} STX | {txid[:12]}...")

            analysis = self.analyze_whale(tx)
            self.log.info(f"Analysis → risk={analysis['risk_level']} pattern={analysis['pattern']}")

            insight = {
                "agent": self.name,
                "type": "whale_analysis",
                "txid": txid,
                "amount": amount,
                "analysis": analysis
            }
            self.post_insight(insight)
            self.cache_set(f"whale:{txid}", insight)

            # High risk → alert other agents
            if analysis.get("risk_level") == "high" or analysis.get("action_needed"):
                self.publish("satoshi:whale_alert", {
                    "txid": txid,
                    "amount": amount,
                    "analysis": analysis
                })
                self.log.warning(f"High risk published → {txid[:12]}")

        # Memory management
        if len(self.seen_txids) > 1000:
            self.seen_txids = set(list(self.seen_txids)[-500:])

    def handle_messages(self):
        """Process incoming Redis messages (non-blocking)."""
        msg = self.pubsub.get_message(timeout=0.1)
        if msg and msg["type"] == "message":
            import json
            try:
                data = json.loads(msg["data"])
                if data.get("command") == "scan_whales":
                    self.log.info("Scan command received from orchestrator.")
                    self.process_whales()
            except Exception:
                pass

    def run(self):
        self.log.info("SATOSHI active — starting whale tracking.")
        schedule.every(POLL_INTERVAL).seconds.do(self.process_whales)

        # First run
        self.process_whales()

        while True:
            schedule.run_pending()
            self.handle_messages()
            time.sleep(1)


if __name__ == "__main__":
    agent = SatoshiAgent()
    agent.run()
