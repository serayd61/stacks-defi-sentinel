"""
SZABO — Kontrat Güvenlik Taraması Ajanı
─────────────────────────────────────────
Görev:
  • Her 2 dk'da yeni deploy edilen Clarity kontratlarını tarar
  • LLM ile güvenlik açığı analizi yapar (reentrancy, overflow, access control)
  • Satoshi'den yüksek riskli whale uyarısı alınca ilgili kontratı inceler
  • Tehdit tespit edince orchestrator'a bildirir
"""
import time
import os
import json
import schedule
from base_agent import BaseAgent

POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "120"))

SYSTEM_PROMPT = """
Sen bir Clarity akıllı kontrat güvenlik analistisın.
Stacks blockchain'deki Clarity kontratlarını inceler,
reentrancy saldırıları, erişim kontrolü açıkları, integer overflow,
unauthorized mint/burn gibi güvenlik açıklarını tespit edersin.
Yanıtlarını JSON formatında ver.
"""


class SzaboAgent(BaseAgent):

    def __init__(self):
        super().__init__()
        self.scanned_contracts = set()
        self.subscribe("satoshi:whale_alert", "orchestrator:command")

    def scan_contract(self, contract_id: str, contract_code: str = "") -> dict:
        prompt = f"""
Aşağıdaki Clarity kontratını güvenlik açısından analiz et:

Kontrat ID: {contract_id}
Kod (varsa):
{contract_code[:1000] if contract_code else "Kod mevcut değil, ID üzerinden analiz yap."}

Güvenlik raporu (JSON):
{{
  "severity": "none|low|medium|high|critical",
  "vulnerabilities": ["varsa açıklar listesi"],
  "safe_functions": ["güvenli fonksiyon listesi"],
  "recommendation": "önerilen eylem",
  "blacklist": true/false
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
        return {
            "severity": "low",
            "vulnerabilities": [],
            "recommendation": response[:200],
            "blacklist": False
        }

    def get_new_contracts(self) -> list:
        """Sentinel API'dan son deploy edilen kontratları al."""
        try:
            import requests
            r = requests.get(
                f"{self.sentinel_api}/api/contracts/recent",
                params={"limit": 10}, timeout=10
            )
            return r.json() if r.ok else []
        except Exception as e:
            self.log.error(f"Kontrat listesi alınamadı: {e}")
            return []

    def run_scan(self):
        self.log.info("Kontrat güvenlik taraması başlıyor...")
        contracts = self.get_new_contracts()

        if not contracts:
            self.log.info("Yeni kontrat bulunamadı.")
            return

        for contract in contracts:
            cid  = contract.get("contract_id", "")
            code = contract.get("source_code", "")

            if cid in self.scanned_contracts:
                continue

            self.scanned_contracts.add(cid)
            self.log.info(f"Taranıyor: {cid}")

            report = self.scan_contract(cid, code)
            severity = report.get("severity", "none")
            self.log.info(f"Güvenlik raporu → {cid} | severity={severity}")

            self.post_insight({
                "agent": self.name,
                "type": "security_scan",
                "contract_id": cid,
                "report": report
            })

            if severity in ("high", "critical"):
                self.publish("szabo:security_alert", {
                    "contract_id": cid,
                    "severity": severity,
                    "report": report
                })
                self.log.warning(f"GÜVENLİK UYARISI: {cid} → {severity}")

        # Bellek yönetimi
        if len(self.scanned_contracts) > 500:
            self.scanned_contracts = set(list(self.scanned_contracts)[-250:])

    def handle_whale_alert(self, whale_data: dict):
        """Whale hareketi varsa ilgili kontratları tara."""
        txid = whale_data.get("txid", "")
        self.log.info(f"Whale TX için kontrat taraması: {txid[:12]}...")

        contract_id = whale_data.get("contract_id", "")
        if contract_id and contract_id not in self.scanned_contracts:
            report = self.scan_contract(contract_id)
            self.log.info(f"Whale kontrat taraması → {contract_id} | severity={report.get('severity')}")
            self.post_insight({
                "agent": self.name,
                "type": "whale_contract_scan",
                "txid": txid,
                "contract_id": contract_id,
                "report": report
            })

    def handle_messages(self):
        msg = self.pubsub.get_message(timeout=0.1)
        if msg and msg["type"] == "message":
            try:
                data = json.loads(msg["data"])
                channel = msg.get("channel", "")
                if "whale_alert" in channel:
                    self.handle_whale_alert(data)
                elif data.get("command") == "scan_contracts":
                    self.run_scan()
            except Exception as e:
                self.log.error(f"Mesaj işleme hatası: {e}")

    def run(self):
        self.log.info("SZABO aktif — güvenlik taraması başlıyor.")
        schedule.every(POLL_INTERVAL).seconds.do(self.run_scan)
        self.run_scan()

        while True:
            schedule.run_pending()
            self.handle_messages()
            time.sleep(1)


if __name__ == "__main__":
    agent = SzaboAgent()
    agent.run()
