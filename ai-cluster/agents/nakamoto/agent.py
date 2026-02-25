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
import requests as http_requests
from base_agent import BaseAgent

POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "60"))
DEX_SCRAPE_INTERVAL = int(os.getenv("DEX_SCRAPE_INTERVAL", "14400"))  # 4 hours

HYPERBROWSER_API_KEY = os.getenv("HYPERBROWSER_API_KEY", "")
HYPERBROWSER_BASE = "https://api.hyperbrowser.ai/api"

SYSTEM_PROMPT = """
You are a DeFi DEX analyst AI agent.
You monitor decentralized exchanges on the Stacks blockchain (Velar, ALEX, Arkadiko),
detecting price discrepancies, arbitrage opportunities, and liquidity changes.

CRITICAL LANGUAGE RULE: You MUST respond ONLY in English.
Never use Turkish, Spanish, German, or any other non-English language.
Every single word in your response must be in English.
Return concise and clear JSON answers.
"""


class NakamotoAgent(BaseAgent):

    def __init__(self):
        super().__init__()
        self.subscribe("satoshi:whale_alert", "orchestrator:command")
        self.last_web_dex_data = {}

    # ── Hyperbrowser DEX Scraping ─────────────────────────────────────────

    def _hb_scrape(self, url: str) -> str:
        """Scrape a webpage via Hyperbrowser and return markdown content."""
        if not HYPERBROWSER_API_KEY:
            return ""
        try:
            # Start scrape job
            r = http_requests.post(
                f"{HYPERBROWSER_BASE}/scrape",
                headers={"Content-Type": "application/json", "x-api-key": HYPERBROWSER_API_KEY},
                json={"url": url, "scrapeOptions": {"formats": ["markdown"], "onlyMainContent": True, "timeout": 15000}},
                timeout=20,
            )
            if not r.ok:
                self.log.error(f"HB scrape start failed: {r.status_code}")
                return ""
            job_id = r.json().get("jobId", "")
            if not job_id:
                return ""

            # Poll for result (max 60s)
            for _ in range(30):
                time.sleep(2)
                res = http_requests.get(
                    f"{HYPERBROWSER_BASE}/scrape/{job_id}",
                    headers={"x-api-key": HYPERBROWSER_API_KEY},
                    timeout=15,
                )
                if not res.ok:
                    continue
                result = res.json()
                if result.get("status") == "completed":
                    return result.get("data", {}).get("markdown", "")
                if result.get("status") == "failed":
                    self.log.error(f"HB scrape failed: {result.get('error')}")
                    return ""
            return ""
        except Exception as e:
            self.log.error(f"HB scrape error: {e}")
            return ""

    def scrape_dex_data(self):
        """Scrape real DEX data from web sources using Hyperbrowser."""
        if not HYPERBROWSER_API_KEY:
            self.log.info("Hyperbrowser not configured, skipping web DEX scrape.")
            return

        targets = [
            {"name": "DeFi Llama (Stacks)", "url": "https://defillama.com/chain/Stacks"},
            {"name": "Velar", "url": "https://www.velar.co/pools"},
        ]

        for target in targets:
            cached = self.cache_get(f"web_dex:{target['name']}")
            if cached:
                self.log.info(f"Web DEX cache hit: {target['name']}")
                continue

            self.log.info(f"Scraping DEX data from {target['name']}...")
            markdown = self._hb_scrape(target["url"])
            if not markdown:
                continue

            # Use LLM to extract structured data from markdown
            extract_prompt = f"""
Extract DEX pool data from this webpage content.
Source: {target['name']}

Content (first 2000 chars):
{markdown[:2000]}

Return JSON only:
{{
  "source": "{target['name']}",
  "total_tvl_usd": 0,
  "pools": [
    {{"name": "TOKEN0/TOKEN1", "tvl_usd": 0, "volume_24h_usd": 0, "apr_pct": 0}}
  ]
}}
"""
            response = self.think(extract_prompt, SYSTEM_PROMPT)
            try:
                start = response.find("{")
                end = response.rfind("}") + 1
                if start >= 0 and end > start:
                    parsed = json.loads(response[start:end])
                    self.last_web_dex_data[target["name"]] = parsed
                    self.cache_set(f"web_dex:{target['name']}", parsed, ttl=DEX_SCRAPE_INTERVAL)
                    self.post_insight({
                        "agent": self.name,
                        "type": "web_dex_scrape",
                        "source": target["name"],
                        "data": parsed,
                    })
                    self.log.info(f"Web DEX extracted: {target['name']} — {len(parsed.get('pools', []))} pools")
            except Exception as e:
                self.log.error(f"Web DEX parse error ({target['name']}): {e}")

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

        # Hyperbrowser web scraping (every 4 hours)
        if HYPERBROWSER_API_KEY:
            schedule.every(DEX_SCRAPE_INTERVAL).seconds.do(self.scrape_dex_data)
            self.log.info(f"Hyperbrowser DEX scraping enabled (every {DEX_SCRAPE_INTERVAL}s)")
            self.scrape_dex_data()

        self.scan_dex()

        while True:
            schedule.run_pending()
            self.handle_messages()
            time.sleep(1)


if __name__ == "__main__":
    agent = NakamotoAgent()
    agent.run()
