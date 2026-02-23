"""
ORCHESTRATOR — Agentic Cluster Management API
──────────────────────────────────────────────
Endpoints:
  GET  /               -> Cluster dashboard (HTML)
  GET  /api/status     -> All agent statuses (JSON)
  GET  /api/insights   -> Recent AI analyses
  POST /api/command    -> Send command to agents
  GET  /api/health     -> Cluster health check
"""
import os
import json
import time
import redis
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

REDIS_URL   = os.getenv("REDIS_URL", "redis://redis-bus:6379")
OLLAMA_URL  = os.getenv("OLLAMA_URL", "http://da-vinci:11434")
AGENTS      = os.getenv("AGENTS", "satoshi,nakamoto,szabo,finney").split(",")

r = redis.from_url(REDIS_URL, decode_responses=True)

# --- HTML Dashboard ------------------------------------------------
DASHBOARD_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Agentic AI Cluster — DeFi Sentinel</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0a0e1a; color: #e0e0e0; font-family: 'Courier New', monospace; padding: 24px; }
  h1 { color: #00ff9d; font-size: 1.6rem; text-align: center; margin-bottom: 4px; letter-spacing: 2px; }
  .subtitle { color: #666; text-align: center; font-size: 0.75rem; margin-bottom: 32px; letter-spacing: 4px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
  .card { background: #111827; border: 1px solid #1f2937; border-radius: 8px; padding: 16px; }
  .card h3 { color: #facc15; font-size: 0.9rem; margin-bottom: 8px; }
  .card .role { color: #6b7280; font-size: 0.7rem; margin-bottom: 12px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: bold; }
  .badge-online { background: #064e3b; color: #34d399; border: 1px solid #059669; }
  .badge-offline { background: #3b1414; color: #f87171; border: 1px solid #b91c1c; }
  .stat { display: flex; justify-content: space-between; margin-top: 8px; font-size: 0.75rem; }
  .stat-val { color: #60a5fa; }
  .section-title { color: #9ca3af; font-size: 0.7rem; letter-spacing: 3px; margin: 24px 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.75rem; }
  th { color: #6b7280; text-align: left; padding: 8px; border-bottom: 1px solid #1f2937; }
  td { padding: 8px; border-bottom: 1px solid #111827; }
  .refresh { color: #4b5563; font-size: 0.65rem; text-align: center; margin-top: 24px; }
</style>
</head>
<body>
<h1>AGENTIC AI CLUSTER</h1>
<div class="subtitle">STACKS DEFI SENTINEL · CLOSED-LOOP NETWORK TOPOLOGY</div>

<div id="app">Loading...</div>

<div class="refresh" id="refresh-info"></div>

<script>
async function fetchStatus() {
  const res = await fetch('/api/status');
  const data = await res.json();
  render(data);
}

function render(data) {
  const agents = data.agents || [];
  const cluster = data.cluster || {};

  const cards = agents.map(a => `
    <div class="card">
      <h3>${a.name.toUpperCase()}</h3>
      <div class="role">${a.role}</div>
      <span class="badge ${a.online ? 'badge-online' : 'badge-offline'}">
        ${a.online ? '● ONLINE' : '○ OFFLINE'}
      </span>
      <div class="stat"><span>Model</span><span class="stat-val">phi3:mini</span></div>
      <div class="stat"><span>Messages</span><span class="stat-val">${a.message_count || 0}</span></div>
    </div>
  `).join('');

  document.getElementById('app').innerHTML = `
    <p class="section-title">INFERENCE TIER</p>
    <div class="grid">
      <div class="card">
        <h3>DA VINCI</h3>
        <div class="role">Ollama · phi3:mini</div>
        <span class="badge ${cluster.ollama_ok ? 'badge-online' : 'badge-offline'}">
          ${cluster.ollama_ok ? '● ONLINE' : '○ OFFLINE'}
        </span>
        <div class="stat"><span>Type</span><span class="stat-val">PRIMARY INFERENCE</span></div>
      </div>
    </div>

    <p class="section-title">AGENTIC TIER · VIRTUAL TEAM</p>
    <div class="grid">${cards}</div>

    <p class="section-title">RECENT ANALYSES</p>
    <table>
      <tr><th>AGENT</th><th>TYPE</th><th>TIME</th></tr>
      ${(data.recent_insights || []).slice(0,8).map(i => `
        <tr>
          <td style="color:#facc15">${i.agent || '-'}</td>
          <td>${i.type || '-'}</td>
          <td style="color:#6b7280">${i.ts ? new Date(i.ts*1000).toLocaleTimeString('en-US') : '-'}</td>
        </tr>
      `).join('')}
    </table>
  `;

  document.getElementById('refresh-info').textContent =
    'Last update: ' + new Date().toLocaleTimeString('en-US');
}

fetchStatus();
setInterval(fetchStatus, 15000);
</script>
</body>
</html>"""


# --- API Endpoints -------------------------------------------------

@app.route("/")
def dashboard():
    from flask import Response
    return Response(DASHBOARD_HTML, mimetype="text/html")


@app.route("/api/status")
def status():
    agents_status = []
    agent_roles = {
        "satoshi":  "Whale Tracking & Pattern Analysis",
        "nakamoto": "DEX Arbitrage & Price Analysis",
        "szabo":    "Contract Security Scanner",
        "finney":   "User Reports & Notifications"
    }

    for agent in AGENTS:
        heartbeat  = r.get(f"{agent}:heartbeat")
        msg_count  = r.get(f"{agent}:msg_count") or "0"
        online     = heartbeat is not None and (time.time() - float(heartbeat)) < 90

        agents_status.append({
            "name":          agent,
            "role":          agent_roles.get(agent, "agent"),
            "online":        online,
            "last_heartbeat": heartbeat,
            "message_count": int(msg_count)
        })

    # Ollama health check
    ollama_ok = False
    try:
        res = requests.get(f"{OLLAMA_URL}/api/tags", timeout=5)
        ollama_ok = res.ok
    except Exception:
        pass

    # Recent insights
    raw_insights = r.lrange("insights:recent", 0, 19)
    recent_insights = []
    for raw in raw_insights:
        try:
            recent_insights.append(json.loads(raw))
        except Exception:
            pass

    return jsonify({
        "cluster": {
            "name": "sentinel-ai",
            "ollama_ok": ollama_ok,
            "agent_count": len(AGENTS),
            "ts": int(time.time())
        },
        "agents": agents_status,
        "recent_insights": recent_insights
    })


@app.route("/api/insights")
def insights():
    limit = int(request.args.get("limit", 20))
    raw   = r.lrange("insights:recent", 0, limit - 1)
    items = []
    for i in raw:
        try:
            items.append(json.loads(i))
        except Exception:
            pass
    return jsonify({"insights": items, "count": len(items)})


@app.route("/api/command", methods=["POST"])
def command():
    body = request.get_json(silent=True) or {}
    cmd  = body.get("command", "")
    if not cmd:
        return jsonify({"error": "command is required"}), 400

    allowed = {"scan_whales", "scan_dex", "scan_contracts", "generate_report"}
    if cmd not in allowed:
        return jsonify({"error": f"Unknown command: {cmd}"}), 400

    r.publish("orchestrator:command", json.dumps({
        "command": cmd,
        "from": "orchestrator",
        "ts": int(time.time())
    }))
    return jsonify({"ok": True, "command": cmd})


@app.route("/api/health")
def health():
    redis_ok = False
    try:
        r.ping()
        redis_ok = True
    except Exception:
        pass

    return jsonify({
        "status": "ok" if redis_ok else "degraded",
        "redis": redis_ok,
        "ts": int(time.time())
    })


# --- Insight Collector ---------------------------------------------
def insight_collector():
    """
    Writes AI insights from Sentinel API to Redis.
    Orchestrator listens on this endpoint.
    """
    pass  # Hook point for Sentinel API integration


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=9000, debug=False)
