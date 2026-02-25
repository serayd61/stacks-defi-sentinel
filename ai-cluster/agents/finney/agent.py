"""
FINNEY — User Report & Notification Agent
──────────────────────────────────────────
Task:
  • Listens to Redis messages from all agents
  • Generates daily DeFi summary report every morning at 07:00
  • Instantly pushes urgent alerts
  • Writes human-readable summaries with LLM
"""
import time
import os
import json
import schedule
import requests as http_requests
from datetime import datetime
from base_agent import BaseAgent

REPORT_HOUR = int(os.getenv("REPORT_HOUR", "7"))
NEWS_SCRAPE_INTERVAL = int(os.getenv("NEWS_SCRAPE_INTERVAL", "21600"))  # 6 hours

HYPERBROWSER_API_KEY = os.getenv("HYPERBROWSER_API_KEY", "")
HYPERBROWSER_BASE = "https://api.hyperbrowser.ai/api"

SYSTEM_PROMPT = """
You are a DeFi analysis report writer AI agent.
You translate technical data into clear, trustworthy, and actionable language
that even blockchain beginners can understand.

CRITICAL LANGUAGE RULE: You MUST respond ONLY in English.
Never use Turkish, Spanish, German, or any other non-English language.
Every single word in your response must be in English.
"""


class FinneyAgent(BaseAgent):

    def __init__(self):
        super().__init__()
        self.daily_events = []
        self.latest_news = []
        self.subscribe(
            "satoshi:whale_alert",
            "nakamoto:dex_alert",
            "nakamoto:dex_impact",
            "szabo:security_alert",
            "ares:market_intel",
            "orchestrator:command"
        )

    # ─── Hyperbrowser News Scraping ──────────────────────────────

    def _hb_scrape(self, url: str) -> str:
        """Scrape a webpage via Hyperbrowser and return markdown content."""
        if not HYPERBROWSER_API_KEY:
            return ""
        try:
            r = http_requests.post(
                f"{HYPERBROWSER_BASE}/scrape",
                headers={"Content-Type": "application/json", "x-api-key": HYPERBROWSER_API_KEY},
                json={"url": url, "scrapeOptions": {"formats": ["markdown"], "onlyMainContent": True, "timeout": 15000}},
                timeout=20,
            )
            if not r.ok:
                return ""
            job_id = r.json().get("jobId", "")
            if not job_id:
                return ""

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
                    return ""
            return ""
        except Exception as e:
            self.log.error(f"HB scrape error: {e}")
            return ""

    def scrape_news(self):
        """Scrape DeFi news sites for Stacks-related articles."""
        if not HYPERBROWSER_API_KEY:
            self.log.info("Hyperbrowser not configured, skipping news scrape.")
            return

        cached = self.cache_get("web_news:latest")
        if cached:
            self.latest_news = cached
            self.log.info(f"News cache hit ({len(cached)} articles)")
            return

        sources = [
            {"name": "Stacks Blog", "url": "https://www.stacks.co/blog"},
            {"name": "CoinDesk", "url": "https://www.coindesk.com/tag/stacks/"},
        ]

        all_news = []
        for source in sources:
            self.log.info(f"Scraping news from {source['name']}...")
            markdown = self._hb_scrape(source["url"])
            if not markdown:
                continue

            extract_prompt = f"""
Extract news article titles and summaries from this webpage content.
Source: {source['name']}

Content (first 2000 chars):
{markdown[:2000]}

Return JSON only:
{{
  "articles": [
    {{
      "title": "article title",
      "summary": "1-2 sentence summary",
      "relevance": "high|medium|low"
    }}
  ]
}}

Mark articles as "high" relevance if they mention Stacks, STX, sBTC, Clarity, or Stacks DeFi protocols.
"""
            response = self.think(extract_prompt, SYSTEM_PROMPT)
            try:
                start = response.find("{")
                end = response.rfind("}") + 1
                if start >= 0 and end > start:
                    parsed = json.loads(response[start:end])
                    articles = parsed.get("articles", [])
                    for a in articles:
                        a["source"] = source["name"]
                        a["scrapedAt"] = datetime.now().isoformat()
                    all_news.extend(articles)
                    self.log.info(f"News extracted: {source['name']} — {len(articles)} articles")
            except Exception as e:
                self.log.error(f"News parse error ({source['name']}): {e}")

        self.latest_news = all_news[:15]
        if self.latest_news:
            self.cache_set("web_news:latest", self.latest_news, ttl=NEWS_SCRAPE_INTERVAL)
            self.post_insight({
                "agent": self.name,
                "type": "web_news_digest",
                "article_count": len(self.latest_news),
                "articles": self.latest_news[:5],
            })
            self.log.info(f"News digest posted ({len(self.latest_news)} articles)")

    # ─── Report Generation ──────────────────────────────────────
    def generate_daily_report(self) -> str:
        if not self.daily_events and not self.latest_news:
            return "No significant events detected today."

        events_str = json.dumps(self.daily_events[-50:], ensure_ascii=False, indent=2)
        news_str = json.dumps(self.latest_news[:5], ensure_ascii=False, indent=2) if self.latest_news else "No news available."

        prompt = f"""
Using the following DeFi events and news, write a daily summary report in English.
The report should cover significant whale movements, DEX opportunities, security alerts,
and relevant Stacks ecosystem news.
Keep it concise: maximum 6 paragraphs.

Events:
{events_str[:1500]}

Latest News:
{news_str[:500]}

Write the report in natural language, not JSON.
"""
        report = self.think(prompt, SYSTEM_PROMPT)
        return report if report else "Report could not be generated."

    def send_daily_report(self):
        self.log.info("Generating daily report...")
        report_text = self.generate_daily_report()

        report = {
            "agent": self.name,
            "type": "daily_report",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "content": report_text,
            "event_count": len(self.daily_events)
        }

        self.post_insight(report)
        self.log.info(f"Daily report sent ({len(self.daily_events)} events).")

        # Clear daily events
        self.daily_events.clear()

    # ─── Instant Alerts ─────────────────────────────────────────
    def format_urgent_alert(self, data: dict, alert_type: str) -> str:
        if alert_type == "whale":
            amount   = data.get("amount", 0)
            analysis = data.get("analysis", {})
            prompt = (
                f"Summarize the following whale event in 2 sentences in English: "
                f"{amount} STX transferred, risk={analysis.get('risk_level')}, "
                f"pattern={analysis.get('pattern')}. What do you recommend the user do?"
            )
        elif alert_type == "security":
            cid      = data.get("contract_id", "unknown")
            severity = data.get("severity", "?")
            prompt   = (
                f"Contract security alert: {cid} contract carries {severity} level risk. "
                f"Tell the user in 2 sentences what they should do."
            )
        elif alert_type == "dex":
            analysis = data.get("analysis", {})
            prompt   = (
                f"DEX alert: {analysis.get('recommendation', '')} "
                f"urgency={analysis.get('urgency')}. "
                f"Explain the opportunity or risk to the user in 2 sentences in English."
            )
        else:
            prompt = f"Briefly summarize the following event in English: {json.dumps(data)[:300]}"

        return self.think(prompt, SYSTEM_PROMPT)

    def push_alert(self, alert_type: str, data: dict, raw_data: dict):
        message = self.format_urgent_alert(raw_data, alert_type)
        alert = {
            "agent": self.name,
            "type": f"urgent_alert_{alert_type}",
            "message": message,
            "raw": raw_data,
            "timestamp": datetime.now().isoformat()
        }
        self.post_insight(alert)
        self.log.info(f"Instant alert sent [{alert_type}]: {message[:80]}...")

    # ─── Message Listener ───────────────────────────────────────
    def handle_messages(self):
        msg = self.pubsub.get_message(timeout=0.1)
        if not msg or msg["type"] != "message":
            return

        try:
            data    = json.loads(msg["data"])
            channel = msg.get("channel", "")

            # Add to daily events list
            self.daily_events.append({"channel": channel, **data})

            # Urgent alerts
            if "whale_alert" in channel:
                self.push_alert("whale", data, data)
            elif "security_alert" in channel:
                self.push_alert("security", data, data)
            elif "dex_alert" in channel:
                self.push_alert("dex", data, data)
            elif data.get("command") == "generate_report":
                self.send_daily_report()

        except Exception as e:
            self.log.error(f"Message processing error: {e}")

    def run(self):
        self.log.info(f"FINNEY active — daily report time: {REPORT_HOUR:02d}:00")

        schedule.every().day.at(f"{REPORT_HOUR:02d}:00").do(self.send_daily_report)

        # Hyperbrowser news scraping (every 6 hours)
        if HYPERBROWSER_API_KEY:
            schedule.every(NEWS_SCRAPE_INTERVAL).seconds.do(self.scrape_news)
            self.log.info(f"Hyperbrowser news scraping enabled (every {NEWS_SCRAPE_INTERVAL}s)")
            self.scrape_news()

        while True:
            schedule.run_pending()
            self.handle_messages()
            time.sleep(1)


if __name__ == "__main__":
    agent = FinneyAgent()
    agent.run()
