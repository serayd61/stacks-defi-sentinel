"""
NAKAMOTO — DEX Arbitrage & Price Analysis Agent
────────────────────────────────────────────────
Task:
  • Fetches DEX data every 60s (Velar, ALEX, Arkadiko)
  • Performs arbitrage opportunity and price deviation analysis with LLM
  • Calculates DEX impact when whale alert received from Satoshi
  • Sends summary report to Finney
"""
import time
import os
import json
import schedule
from base_agent import BaseAgent

POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "60"))

SYSTEM_PROMPT = """
You are a DeFi DEX analyst AI agent.
You monitor decentralized exchanges on the Stacks blockchain (Velar, ALEX, Arkadiko),
detecting price discrepancies, arbitrage opportunities, and liquidity changes.
Always respond in English. Return concise and clear JSON answers.
"""


class NakamotoAgent(BaseAgent):

    def __init__(self):
        super().__init__()
        self.subscribe("satoshi:whale_alert", "orchestrator:command")

    def analyze_dex(self, dex_data: dict) -> dict:
        if not dex_data:
            return {}

        prompt = f"""
Analyze the following DEX data:

{json.dumps(dex_data, indent=2)[:1500]}

Answer the following questions (JSON):
{{
  "arbitrage_opportunity": true/false,
  "best_pair": "e.g. TOKEN/STX",
  "price_deviation_pct": 0.0,
  "liquidity_trend": "increasing|decreasing|stable",
  "recommendation": "short explanation in English",
  "urgency": "low|medium|high"
}}
"""
        response = self.think(prompt, SYSTEM_PROMPT)
        try:
            start = response.find("{")
            end   = response.rfind("}") + 1
            if start >= 0 and end > start:
                return json.loads(response[start:end])
        except Exception:
            pass
        return {"arbitrage_opportunity": False, "recommendation": response[:200]}

    def analyze_whale_dex_impact(self, whale_data: dict):
        """Calculate DEX impact when whale alert received from Satoshi."""
        amount  = whale_data.get("amount", 0)
        pattern = whale_data.get("analysis", {}).get("pattern", "")

        prompt = f"""
A whale movement of {amount} STX has been detected.
Movement pattern: {pattern}

How will this movement affect Stacks DEX platforms? (JSON):
{{
  "expected_price_impact_pct": 0.0,
  "affected_pools": ["pool1", "pool2"],
  "suggested_action": "explanation in English",
  "window_minutes": 0
}}
"""
        response = self.think(prompt, SYSTEM_PROMPT)
        try:
            start = response.find("{")
            end   = response.rfind("}") + 1
            if start >= 0 and end > start:
                impact = json.loads(response[start:end])
                self.log.info(f"Whale DEX impact: {impact}")
                self.publish("nakamoto:dex_impact", {
                    "whale_amount": amount,
                    "impact": impact
                })
                self.post_insight({
                    "agent": self.name,
                    "type": "dex_impact_analysis",
                    "whale_amount": amount,
                    "impact": impact
                })
        except Exception as e:
            self.log.error(f"DEX impact analysis error: {e}")

    def scan_dex(self):
        self.log.info("Starting DEX scan...")
        dex_data = self.get_dex_data()
        if not dex_data:
            self.log.warning("Could not fetch DEX data.")
            return

        analysis = self.analyze_dex(dex_data)
        if not analysis:
            return

        self.log.info(
            f"DEX analysis → arbitrage={analysis.get('arbitrage_opportunity')} "
            f"urgency={analysis.get('urgency', 'low')}"
        )

        self.cache_set("latest_dex_analysis", analysis, ttl=120)
        self.post_insight({
            "agent": self.name,
            "type": "dex_analysis",
            "analysis": analysis
        })

        if analysis.get("urgency") == "high":
            self.publish("nakamoto:dex_alert", {"analysis": analysis})

        # Periodic summary to Finney
        self.publish("nakamoto:summary", {
            "type": "dex_summary",
            "analysis": analysis
        })

    def handle_messages(self):
        msg = self.pubsub.get_message(timeout=0.1)
        if msg and msg["type"] == "message":
            try:
                data = json.loads(msg["data"])
                if "whale_alert" in msg.get("channel", "") or data.get("type") == "whale_analysis":
                    self.analyze_whale_dex_impact(data)
                elif data.get("command") == "scan_dex":
                    self.scan_dex()
            except Exception as e:
                self.log.error(f"Message processing error: {e}")

    def run(self):
        self.log.info("NAKAMOTO active — starting DEX analysis.")
        schedule.every(POLL_INTERVAL).seconds.do(self.scan_dex)
        self.scan_dex()

        while True:
            schedule.run_pending()
            self.handle_messages()
            time.sleep(1)


if __name__ == "__main__":
    agent = NakamotoAgent()
    agent.run()
