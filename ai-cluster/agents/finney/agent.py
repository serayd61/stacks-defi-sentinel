"""
FINNEY — Kullanıcı Rapor & Bildirim Ajanı
──────────────────────────────────────────
Görev:
  • Tüm agentlardan gelen Redis mesajlarını dinler
  • Her sabah 07:00'de günlük DeFi özet raporu üretir
  • Acil uyarıları anlık push eder
  • LLM ile insan okunabilir özet yazar
"""
import time
import os
import json
import schedule
from datetime import datetime
from base_agent import BaseAgent

REPORT_HOUR = int(os.getenv("REPORT_HOUR", "7"))

SYSTEM_PROMPT = """
Sen bir DeFi analiz raporu yazarısın.
Teknik verileri, blockchain yeni başlayanların da anlayabileceği
sade, güven veren ve eyleme yönelik bir dille aktarırsın.
Türkçe veya İngilizce yazabilirsin, bağlama göre karar ver.
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

    # ─── Rapor Üretimi ─────────────────────────────────────────
    def generate_daily_report(self) -> str:
        if not self.daily_events:
            return "Bugün kayda değer bir olay tespit edilmedi."

        events_str = json.dumps(self.daily_events[-50:], ensure_ascii=False, indent=2)
        prompt = f"""
Aşağıdaki DeFi olaylarını kullanarak günlük bir özet raporu yaz.
Rapor; önemli whale hareketlerini, DEX fırsatlarını ve güvenlik uyarılarını kapsamalı.
Kısa tutarsın: maksimum 5 paragraf.

Olaylar:
{events_str[:2000]}

Raporu doğal dil ile yaz, JSON değil.
"""
        report = self.think(prompt, SYSTEM_PROMPT)
        return report if report else "Rapor üretilemedi."

    def send_daily_report(self):
        self.log.info("Günlük rapor hazırlanıyor...")
        report_text = self.generate_daily_report()

        report = {
            "agent": self.name,
            "type": "daily_report",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "content": report_text,
            "event_count": len(self.daily_events)
        }

        self.post_insight(report)
        self.log.info(f"Günlük rapor gönderildi ({len(self.daily_events)} olay).")

        # Günlük olayları temizle
        self.daily_events.clear()

    # ─── Anlık Uyarılar ────────────────────────────────────────
    def format_urgent_alert(self, data: dict, alert_type: str) -> str:
        if alert_type == "whale":
            amount   = data.get("amount", 0)
            analysis = data.get("analysis", {})
            prompt = (
                f"Şu whale olayını 2 cümleyle özetle: "
                f"{amount} STX transfer edildi, risk={analysis.get('risk_level')}, "
                f"pattern={analysis.get('pattern')}. Kullanıcıya ne yapmasını önerirsin?"
            )
        elif alert_type == "security":
            cid      = data.get("contract_id", "bilinmiyor")
            severity = data.get("severity", "?")
            prompt   = (
                f"Kontrat güvenlik uyarısı: {cid} kontratı {severity} seviye risk taşıyor. "
                f"Kullanıcıya 2 cümleyle ne yapmasını söylersin?"
            )
        elif alert_type == "dex":
            analysis = data.get("analysis", {})
            prompt   = (
                f"DEX uyarısı: {analysis.get('recommendation', '')} "
                f"urgency={analysis.get('urgency')}. "
                f"Kullanıcıya 2 cümleyle fırsat veya riski açıkla."
            )
        else:
            prompt = f"Şu olayı kısaca özetle: {json.dumps(data)[:300]}"

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
        self.log.info(f"Anlık uyarı gönderildi [{alert_type}]: {message[:80]}...")

    # ─── Mesaj Dinleyici ───────────────────────────────────────
    def handle_messages(self):
        msg = self.pubsub.get_message(timeout=0.1)
        if not msg or msg["type"] != "message":
            return

        try:
            data    = json.loads(msg["data"])
            channel = msg.get("channel", "")

            # Günlük olaylar listesine ekle
            self.daily_events.append({"channel": channel, **data})

            # Acil uyarılar
            if "whale_alert" in channel:
                self.push_alert("whale", data, data)
            elif "security_alert" in channel:
                self.push_alert("security", data, data)
            elif "dex_alert" in channel:
                self.push_alert("dex", data, data)
            elif data.get("command") == "generate_report":
                self.send_daily_report()

        except Exception as e:
            self.log.error(f"Mesaj işleme hatası: {e}")

    def run(self):
        self.log.info(f"FINNEY aktif — günlük rapor saati: {REPORT_HOUR:02d}:00")

        schedule.every().day.at(f"{REPORT_HOUR:02d}:00").do(self.send_daily_report)

        while True:
            schedule.run_pending()
            self.handle_messages()
            time.sleep(1)


if __name__ == "__main__":
    agent = FinneyAgent()
    agent.run()
