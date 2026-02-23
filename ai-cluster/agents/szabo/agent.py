"""
SZABO — Contract Security Scanner Agent
─────────────────────────────────────────
Task:
  • Scans newly deployed Clarity contracts every 2 minutes
  • Performs security vulnerability analysis with LLM (reentrancy, overflow, access control)
  • Scans related contract when high-risk whale alert received from Satoshi
  • Notifies orchestrator when threat detected
"""
import time
import os
import json
import schedule
from base_agent import BaseAgent

POLL_INTERVAL = int(os.getenv("POLL_INTERVAL", "120"))

SYSTEM_PROMPT = """
You are a Clarity smart contract security analyst AI agent.
You analyze Clarity contracts on the Stacks blockchain,
detecting security vulnerabilities such as reentrancy attacks,
access control flaws, integer overflow, and unauthorized mint/burn.
Always respond in English. Return your answers in JSON format.
"""


class SzaboAgent(BaseAgent):

    def __init__(self):
        super().__init__()
        self.scanned_contracts = set()
        self.subscribe("satoshi:whale_alert", "orchestrator:command")

    def scan_contract(self, contract_id: str, contract_code: str = "") -> dict:
        prompt = f"""
Analyze the following Clarity contract for security vulnerabilities:

Contract ID: {contract_id}
Code (if available):
{contract_code[:1000] if contract_code else "No code available, analyze based on contract ID."}

Security report (JSON):
{{
  "severity": "none|low|medium|high|critical",
  "vulnerabilities": ["list of vulnerabilities if any"],
  "safe_functions": ["list of safe functions"],
  "recommendation": "recommended action in English",
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
        """Fetch recently deployed Clarity contracts from Hiro API."""
        try:
            import requests
            r = requests.get(
                "https://api.hiro.so/extended/v1/tx",
                params={"type": "smart_contract", "limit": 10, "order": "desc", "order_by": "block_height"},
                timeout=20
            )
            if not r.ok:
                return []
            contracts = []
            for tx in r.json().get("results", []):
                sc = tx.get("smart_contract", {})
                contracts.append({
                    "contract_id": sc.get("contract_id", ""),
                    "source_code": sc.get("source_code", ""),
                    "deployer":    tx.get("sender_address", ""),
                    "block_time":  tx.get("burn_block_time_iso", ""),
                })
            return contracts
        except Exception as e:
            self.log.error(f"Hiro contracts fetch error: {e}")
            return []

    def run_scan(self):
        self.log.info("Starting contract security scan...")
        contracts = self.get_new_contracts()

        if not contracts:
            self.log.info("No new contracts found.")
            return

        for contract in contracts:
            cid  = contract.get("contract_id", "")
            code = contract.get("source_code", "")

            if cid in self.scanned_contracts:
                continue

            self.scanned_contracts.add(cid)
            self.log.info(f"Scanning: {cid}")

            report   = self.scan_contract(cid, code)
            severity = report.get("severity", "none")
            self.log.info(f"Security report → {cid} | severity={severity}")

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
                self.log.warning(f"SECURITY ALERT: {cid} → {severity}")

        # Memory management
        if len(self.scanned_contracts) > 500:
            self.scanned_contracts = set(list(self.scanned_contracts)[-250:])

    def handle_whale_alert(self, whale_data: dict):
        """Scan related contracts when whale movement detected."""
        txid = whale_data.get("txid", "")
        self.log.info(f"Contract scan for whale TX: {txid[:12]}...")

        contract_id = whale_data.get("contract_id", "")
        if contract_id and contract_id not in self.scanned_contracts:
            report = self.scan_contract(contract_id)
            self.log.info(f"Whale contract scan → {contract_id} | severity={report.get('severity')}")
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
                data    = json.loads(msg["data"])
                channel = msg.get("channel", "")
                if "whale_alert" in channel:
                    self.handle_whale_alert(data)
                elif data.get("command") == "scan_contracts":
                    self.run_scan()
            except Exception as e:
                self.log.error(f"Message processing error: {e}")

    def run(self):
        self.log.info("SZABO active — starting security scanner.")
        schedule.every(POLL_INTERVAL).seconds.do(self.run_scan)
        self.run_scan()

        while True:
            schedule.run_pending()
            self.handle_messages()
            time.sleep(1)


if __name__ == "__main__":
    agent = SzaboAgent()
    agent.run()
