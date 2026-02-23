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
from datetime import datetime
from base_agent import BaseAgent

REPORT_HOUR = int(os.getenv("REPORT_HOUR", "7"))

SYSTEM_PROMPT = """
You are a DeFi analysis report writer AI agent.
You translate technical data into clear, trustworthy, and actionable language
that even blockchain beginners can understand.
Always write in English.
"""


class FinneyAgent(BaseAgent):

    def __init__(self):
        super().__init__()
        self.daily_events = []
        self.subscribe(
            "satoshi:whale_alert",
            "nakamoto:dex_alert",
            "nakamoto:dex_impact",
            "szabo:security_alert",
            "orchestrator:command"
        )

    # ─── Report Generation ──────────────────────────────────────
    def generate_daily_report(self) -> str:
        if not self.daily_events:
            return "No significant events detected today."

        events_str = json.dumps(self.daily_events[-50:], ensure_ascii=False, indent=2)
        prompt = f"""
Using the following DeFi events, write a daily summary report in English.
The report should cover significant whale movements, DEX opportunities, and security alerts.
Keep it concise: maximum 5 paragraphs.

Events:
{events_str[:2000]}

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

        while True:
            schedule.run_pending()
            self.handle_messages()
            time.sleep(1)


if __name__ == "__main__":
    agent = FinneyAgent()
    agent.run()
