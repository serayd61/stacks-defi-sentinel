"""
GAUSS — Wallet Clustering & Smart Money Divergence Agent
─────────────────────────────────────────────────────────
Task:
  - Builds wallet interaction graph from STX transfers
  - Clusters wallets using label propagation algorithm
  - Scores clusters for accumulation vs distribution
  - Detects smart money divergence from price action
  - Publishes cluster updates and divergence signals
"""
import json
import os
import random
import time
from collections import defaultdict

import schedule
from base_agent import BaseAgent

# ── Configuration ──────────────────────────────────────────
POLL_INTERVAL     = int(os.getenv("POLL_INTERVAL", "30"))
CLUSTER_INTERVAL  = int(os.getenv("CLUSTER_INTERVAL", "300"))
MAX_WALLETS       = int(os.getenv("MAX_WALLETS", "5000"))
MAX_EDGES_PER_WALLET = 50
DATA_TTL_SECONDS  = 7 * 24 * 3600  # 7 days
CLUSTER_TTL       = 24 * 3600       # 24 hours
SCORE_HISTORY_MAX = 168              # 7 days hourly
MIN_CLUSTER_SIZE  = 2
DIVERGENCE_STRENGTH_THRESHOLD = 20

SYSTEM_PROMPT = """
You are a blockchain wallet behavior analyst AI agent.
You analyze wallet cluster patterns on the Stacks blockchain,
classify groups of wallets by their collective trading behavior,
and detect smart money divergence signals.
Always respond in English. Return your answers in JSON format.
"""


class GaussAgent(BaseAgent):

    def __init__(self):
        super().__init__()
        # Wallet interaction graph: addr -> {edges: {addr: edge_data}, metadata: {}}
        self.wallet_graph = {}
        # Cluster results: cluster_id -> cluster_data
        self.clusters = {}
        # Price history for divergence detection
        self.price_history = []
        # Track seen transactions for dedup
        self.seen_txids = set()
        # Last cluster calculation timestamp
        self.last_cluster_time = 0
        # Last score snapshot timestamp
        self.last_score_snapshot = 0
        # Last divergence check timestamp
        self.last_divergence_check = 0

        self.subscribe("satoshi:whale_alert", "orchestrator:command")
        self.log.info("GAUSS active — wallet clustering engine initialized.")

    # ── Graph Building ─────────────────────────────────────

    def add_edge(self, sender: str, receiver: str, amount: float, timestamp: float):
        """Add or update an edge in the wallet graph."""
        if not sender or not receiver or sender == receiver:
            return

        now = time.time()

        # Initialize sender node
        if sender not in self.wallet_graph:
            self.wallet_graph[sender] = {
                "edges": {},
                "metadata": {
                    "total_sent": 0.0,
                    "total_received": 0.0,
                    "tx_count": 0,
                    "dex_interactions": [],
                    "first_seen": now,
                    "last_seen": now,
                }
            }

        # Initialize receiver node
        if receiver not in self.wallet_graph:
            self.wallet_graph[receiver] = {
                "edges": {},
                "metadata": {
                    "total_sent": 0.0,
                    "total_received": 0.0,
                    "tx_count": 0,
                    "dex_interactions": [],
                    "first_seen": now,
                    "last_seen": now,
                }
            }

        # Update sender -> receiver edge
        edges = self.wallet_graph[sender]["edges"]
        if receiver not in edges:
            edges[receiver] = {
                "total_volume": 0.0,
                "tx_count": 0,
                "last_seen": now,
                "direction": "outgoing",
            }
        edges[receiver]["total_volume"] += amount
        edges[receiver]["tx_count"] += 1
        edges[receiver]["last_seen"] = now

        # Update receiver -> sender edge (reverse direction)
        rev_edges = self.wallet_graph[receiver]["edges"]
        if sender not in rev_edges:
            rev_edges[sender] = {
                "total_volume": 0.0,
                "tx_count": 0,
                "last_seen": now,
                "direction": "incoming",
            }
        rev_edges[sender]["total_volume"] += amount
        rev_edges[sender]["tx_count"] += 1
        rev_edges[sender]["last_seen"] = now

        # Update metadata
        self.wallet_graph[sender]["metadata"]["total_sent"] += amount
        self.wallet_graph[sender]["metadata"]["tx_count"] += 1
        self.wallet_graph[sender]["metadata"]["last_seen"] = now

        self.wallet_graph[receiver]["metadata"]["total_received"] += amount
        self.wallet_graph[receiver]["metadata"]["tx_count"] += 1
        self.wallet_graph[receiver]["metadata"]["last_seen"] = now

        # Prune edges if over limit
        self._prune_edges(sender)
        self._prune_edges(receiver)

    def _prune_edges(self, addr: str):
        """Keep only top MAX_EDGES_PER_WALLET edges by volume."""
        edges = self.wallet_graph[addr]["edges"]
        if len(edges) <= MAX_EDGES_PER_WALLET:
            return

        sorted_edges = sorted(
            edges.items(), key=lambda x: x[1]["total_volume"], reverse=True
        )
        self.wallet_graph[addr]["edges"] = dict(sorted_edges[:MAX_EDGES_PER_WALLET])

    def _evict_wallets(self):
        """Evict least recently seen wallets when graph exceeds MAX_WALLETS."""
        if len(self.wallet_graph) <= MAX_WALLETS:
            return

        wallets_by_time = sorted(
            self.wallet_graph.items(),
            key=lambda x: x[1]["metadata"]["last_seen"]
        )
        to_remove = len(self.wallet_graph) - MAX_WALLETS
        for addr, _ in wallets_by_time[:to_remove]:
            del self.wallet_graph[addr]
        self.log.info(f"Evicted {to_remove} stale wallets. Graph size: {len(self.wallet_graph)}")

    def _prune_old_data(self):
        """Remove edges older than DATA_TTL_SECONDS."""
        cutoff = time.time() - DATA_TTL_SECONDS
        to_delete = []
        for addr, node in self.wallet_graph.items():
            if node["metadata"]["last_seen"] < cutoff:
                to_delete.append(addr)
                continue
            old_edges = [
                peer for peer, edge in node["edges"].items()
                if edge["last_seen"] < cutoff
            ]
            for peer in old_edges:
                del node["edges"][peer]

        for addr in to_delete:
            del self.wallet_graph[addr]

        if to_delete:
            self.log.info(f"Pruned {len(to_delete)} expired wallets.")

    # ── Data Collection ────────────────────────────────────

    def collect_transfers(self):
        """Fetch recent STX transfers and build the graph."""
        txs = self.get_whale_alerts()
        new_count = 0

        for tx in txs:
            txid = tx.get("txid", "")
            if txid in self.seen_txids:
                continue

            self.seen_txids.add(txid)
            sender = tx.get("sender", "")
            receiver = tx.get("receiver", "")
            amount = float(tx.get("amount", 0))
            ts = tx.get("timestamp", "")

            try:
                import datetime
                dt = datetime.datetime.fromisoformat(ts.replace("Z", "+00:00"))
                unix_ts = dt.timestamp()
            except Exception:
                unix_ts = time.time()

            self.add_edge(sender, receiver, amount, unix_ts)
            new_count += 1

        # Also fetch regular transfers (not just whales) for graph density
        all_txs = self.get_recent_txs(limit=50)
        for tx in all_txs:
            txid = tx.get("tx_id", "")
            if txid in self.seen_txids:
                continue
            if tx.get("tx_type") != "token_transfer":
                continue

            self.seen_txids.add(txid)
            tt = tx.get("token_transfer", {})
            amount_micro = int(tt.get("amount", 0))
            amount_stx = amount_micro / 1_000_000

            if amount_stx < 100:  # Only track meaningful transfers
                continue

            sender = tx.get("sender_address", "")
            receiver = tt.get("recipient_address", "")
            self.add_edge(sender, receiver, amount_stx, time.time())
            new_count += 1

        # Memory management
        if len(self.seen_txids) > 2000:
            self.seen_txids = set(list(self.seen_txids)[-1000:])

        self._evict_wallets()

        if new_count > 0:
            self.log.info(
                f"Collected {new_count} transfers. "
                f"Graph: {len(self.wallet_graph)} wallets."
            )

        # Update heartbeat
        self.redis.set(f"{self.name}:heartbeat", str(int(time.time())))
        msg_count = self.redis.get(f"{self.name}:msg_count") or "0"
        self.redis.set(f"{self.name}:msg_count", str(int(msg_count) + new_count))

    # ── Label Propagation Clustering ───────────────────────

    def cluster_wallets(self):
        """Run label propagation clustering on the wallet graph."""
        if len(self.wallet_graph) < MIN_CLUSTER_SIZE:
            self.log.info("Not enough wallets for clustering.")
            return {}

        # Step 1: Assign initial labels
        addresses = list(self.wallet_graph.keys())
        labels = {addr: i for i, addr in enumerate(addresses)}

        # Step 2: Iterative propagation
        for iteration in range(20):
            changed = False
            random.shuffle(addresses)

            for addr in addresses:
                node = self.wallet_graph.get(addr)
                if not node:
                    continue
                neighbors = node["edges"]
                if not neighbors:
                    continue

                # Weight votes by transfer volume
                label_votes = defaultdict(float)
                for neighbor, edge_data in neighbors.items():
                    if neighbor in labels:
                        neighbor_label = labels[neighbor]
                        weight = edge_data["total_volume"]
                        label_votes[neighbor_label] += weight

                if label_votes:
                    best_label = max(label_votes, key=label_votes.get)
                    if labels[addr] != best_label:
                        labels[addr] = best_label
                        changed = True

            if not changed:
                self.log.info(f"Clustering converged at iteration {iteration + 1}.")
                break

        # Step 3: Group wallets by label
        cluster_map = defaultdict(list)
        for addr, label in labels.items():
            cluster_map[label].append(addr)

        # Step 4: Filter single-wallet clusters
        clusters = {}
        idx = 0
        for label, wallets in cluster_map.items():
            if len(wallets) < MIN_CLUSTER_SIZE:
                continue

            cluster_id = f"cluster_{idx:04d}"
            cluster_data = self._build_cluster_data(cluster_id, wallets)
            clusters[cluster_id] = cluster_data
            idx += 1

        self.clusters = clusters
        self.log.info(
            f"Clustering complete: {len(clusters)} clusters "
            f"from {len(self.wallet_graph)} wallets."
        )
        return clusters

    def _build_cluster_data(self, cluster_id: str, wallets: list) -> dict:
        """Build cluster metadata from wallet list."""
        total_volume = 0.0
        total_sent = 0.0
        total_received = 0.0
        tx_count = 0
        dex_set = set()
        first_seen = float("inf")
        last_activity = 0

        for addr in wallets:
            node = self.wallet_graph.get(addr, {})
            meta = node.get("metadata", {})
            total_sent += meta.get("total_sent", 0)
            total_received += meta.get("total_received", 0)
            tx_count += meta.get("tx_count", 0)
            dex_set.update(meta.get("dex_interactions", []))
            fs = meta.get("first_seen", float("inf"))
            ls = meta.get("last_seen", 0)
            if fs < first_seen:
                first_seen = fs
            if ls > last_activity:
                last_activity = ls

        total_volume = total_sent + total_received
        avg_tx_size = total_volume / max(tx_count, 1)

        # Classify cluster type
        cluster_type = self._classify_cluster(
            wallets, total_volume, avg_tx_size, tx_count
        )

        # Calculate accumulation score
        acc_score = self._calculate_accumulation_score(wallets)

        return {
            "id": cluster_id,
            "wallets": wallets[:20],  # Limit wallet list in response
            "walletCount": len(wallets),
            "type": cluster_type,
            "totalVolume": round(total_volume, 2),
            "totalSent": round(total_sent, 2),
            "totalReceived": round(total_received, 2),
            "avgTxSize": round(avg_tx_size, 2),
            "txCount": tx_count,
            "dominantDex": list(dex_set)[0] if dex_set else "unknown",
            "activeSince": time.strftime(
                "%Y-%m-%dT%H:%M:%SZ", time.gmtime(first_seen)
            ) if first_seen < float("inf") else "",
            "lastActivity": time.strftime(
                "%Y-%m-%dT%H:%M:%SZ", time.gmtime(last_activity)
            ) if last_activity > 0 else "",
            "accumulationScore": acc_score,
            "scoreTrend": self._get_score_trend(cluster_id),
            "updatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

    def _classify_cluster(
        self, wallets: list, total_volume: float,
        avg_tx_size: float, tx_count: int
    ) -> str:
        """Classify cluster type based on heuristics."""
        wallet_count = len(wallets)

        # Whale group: high volume, few wallets
        if total_volume > 500_000 and wallet_count <= 10:
            return "whale_group"

        # Bot network: many transactions, similar sizes, many wallets
        if tx_count > 50 and wallet_count > 5 and avg_tx_size < 5000:
            return "bot_network"

        # Market maker: balanced send/receive across wallets
        balanced_count = 0
        for addr in wallets:
            meta = self.wallet_graph.get(addr, {}).get("metadata", {})
            sent = meta.get("total_sent", 0)
            recv = meta.get("total_received", 0)
            total = sent + recv
            if total > 0 and 0.3 < (sent / total) < 0.7:
                balanced_count += 1
        if balanced_count > wallet_count * 0.6:
            return "market_maker"

        # Exchange: very high volume, many counterparties
        if total_volume > 1_000_000 and wallet_count > 20:
            return "exchange"

        return "retail"

    # ── Accumulation/Distribution Scoring ──────────────────

    def _calculate_accumulation_score(self, wallets: list) -> int:
        """
        Calculate accumulation/distribution score for a cluster.
        Range: -100 (heavy distribution) to +100 (heavy accumulation)

        Components (weighted):
          Net Flow     (40%): incoming vs outgoing STX volume
          DEX Buy/Sell (30%): proxy from net flow direction
          Liquidity    (15%): add vs remove behavior
          Velocity     (15%): recent vs older activity ratio
        """
        total_received = 0.0
        total_sent = 0.0
        recent_volume = 0.0  # last 6 hours
        older_volume = 0.0   # 6-24 hours ago

        now = time.time()
        six_hours_ago = now - 6 * 3600
        twenty_four_hours_ago = now - 24 * 3600

        for addr in wallets:
            node = self.wallet_graph.get(addr, {})
            meta = node.get("metadata", {})
            total_received += meta.get("total_received", 0)
            total_sent += meta.get("total_sent", 0)

            # Estimate velocity from edge timestamps
            for peer, edge in node.get("edges", {}).items():
                ls = edge.get("last_seen", 0)
                vol = edge.get("total_volume", 0)
                if ls >= six_hours_ago:
                    recent_volume += vol
                elif ls >= twenty_four_hours_ago:
                    older_volume += vol

        # Component 1: Net flow (40%)
        total_flow = total_received + total_sent
        if total_flow == 0:
            net_flow_score = 0
        else:
            net_flow_score = ((total_received - total_sent) / total_flow) * 100

        # Component 2: DEX buy/sell proxy (30%)
        # Net inflow implies buying, net outflow implies selling
        dex_score = net_flow_score * 0.8  # Correlated with net flow

        # Component 3: Liquidity behavior (15%)
        # Approximation: wallets adding liquidity tend to have balanced flow
        liq_score = 0  # Neutral by default without specific liquidity data

        # Component 4: Velocity trend (15%)
        if older_volume == 0:
            velocity_score = 0 if recent_volume == 0 else 50
        else:
            ratio = recent_volume / older_volume
            velocity_score = min(max((ratio - 1) * 50, -100), 100)

        # Weighted combination
        score = (
            net_flow_score * 0.40
            + dex_score * 0.30
            + liq_score * 0.15
            + velocity_score * 0.15
        )

        return max(-100, min(100, round(score)))

    def _get_score_trend(self, cluster_id: str) -> list:
        """Get historical score trend from Redis."""
        raw = self.redis.get(f"gauss:score_history:{cluster_id}")
        if raw:
            try:
                history = json.loads(raw)
                # Return last 24 entries for display
                return [entry["score"] for entry in history[-24:]]
            except Exception:
                pass
        return []

    def _snapshot_scores(self):
        """Take hourly score snapshots for all clusters."""
        now = int(time.time())

        for cluster_id, cluster in self.clusters.items():
            score = cluster.get("accumulationScore", 0)
            key = f"gauss:score_history:{cluster_id}"
            raw = self.redis.get(key)

            history = []
            if raw:
                try:
                    history = json.loads(raw)
                except Exception:
                    history = []

            history.append({"ts": now, "score": score})

            # Keep max SCORE_HISTORY_MAX entries
            if len(history) > SCORE_HISTORY_MAX:
                history = history[-SCORE_HISTORY_MAX:]

            self.redis.setex(key, DATA_TTL_SECONDS, json.dumps(history))

        self.last_score_snapshot = now
        self.log.info(f"Score snapshots saved for {len(self.clusters)} clusters.")

    # ── Smart Money Identification ─────────────────────────

    def _identify_smart_money(self) -> list:
        """
        Identify smart money clusters.
        Must meet at least 2 of 4 criteria:
          1. High volume (top 10%)
          2. Consistent activity (active 5+ of last 7 days)
          3. Classification: whale_group or market_maker
          4. Historical profitability (score correlated with price moves)
        """
        if not self.clusters:
            return []

        all_clusters = list(self.clusters.values())
        volumes = sorted(
            [c["totalVolume"] for c in all_clusters], reverse=True
        )
        volume_threshold = volumes[max(0, len(volumes) // 10)] if volumes else 0

        smart_money = []

        for cluster in all_clusters:
            criteria_met = 0
            cluster_id = cluster["id"]

            # Criterion 1: High volume
            if cluster["totalVolume"] >= volume_threshold and volume_threshold > 0:
                criteria_met += 1

            # Criterion 2: Consistent activity
            active_days = self._count_active_days(cluster_id)
            if active_days >= 5:
                criteria_met += 1

            # Criterion 3: Classification
            if cluster["type"] in ("whale_group", "market_maker"):
                criteria_met += 1

            # Criterion 4: Historical score-price correlation
            if self._check_price_correlation(cluster_id) > 0.6:
                criteria_met += 1

            if criteria_met >= 2:
                smart_money.append(cluster_id)

        return smart_money

    def _count_active_days(self, cluster_id: str) -> int:
        """Count how many of the last 7 days the cluster was active."""
        raw = self.redis.get(f"gauss:score_history:{cluster_id}")
        if not raw:
            return 1  # Currently active = at least 1 day

        try:
            history = json.loads(raw)
        except Exception:
            return 1

        now = time.time()
        active_days = set()
        for entry in history:
            ts = entry.get("ts", 0)
            if now - ts <= 7 * 24 * 3600:
                day = int(ts // (24 * 3600))
                active_days.add(day)

        return len(active_days)

    def _check_price_correlation(self, cluster_id: str) -> float:
        """
        Check if cluster's accumulation scores correlated with price increases.
        Returns correlation coefficient (0-1).
        """
        raw = self.redis.get(f"gauss:score_history:{cluster_id}")
        if not raw or len(self.price_history) < 6:
            return 0.0

        try:
            score_history = json.loads(raw)
        except Exception:
            return 0.0

        if len(score_history) < 6:
            return 0.0

        # Simple correlation: count how often score direction matches
        # subsequent price direction
        matches = 0
        total = 0

        for i in range(len(score_history) - 1):
            score_ts = score_history[i]["ts"]
            score_val = score_history[i]["score"]

            # Find matching price entries
            price_before = None
            price_after = None
            for ph in self.price_history:
                if abs(ph["ts"] - score_ts) < 7200:  # within 2 hours
                    price_before = ph["price"]
                if abs(ph["ts"] - score_ts - 3600) < 7200:  # 1 hour later
                    price_after = ph["price"]

            if price_before and price_after:
                score_direction = 1 if score_val > 0 else -1
                price_direction = 1 if price_after > price_before else -1
                if score_direction == price_direction:
                    matches += 1
                total += 1

        return matches / max(total, 1)

    # ── Divergence Detection ───────────────────────────────

    def _update_price_history(self):
        """Fetch current STX price and add to history."""
        dex_data = self.get_dex_data()
        price = dex_data.get("stx_price_usd", 0)
        if price <= 0:
            return

        now = int(time.time())
        self.price_history.append({"ts": now, "price": price})

        # Keep last 168 entries (7 days hourly)
        if len(self.price_history) > SCORE_HISTORY_MAX:
            self.price_history = self.price_history[-SCORE_HISTORY_MAX:]

        # Persist to Redis
        self.redis.setex(
            "gauss:price_history",
            DATA_TTL_SECONDS,
            json.dumps(self.price_history)
        )

    def _load_price_history(self):
        """Load price history from Redis on startup."""
        raw = self.redis.get("gauss:price_history")
        if raw:
            try:
                self.price_history = json.loads(raw)
            except Exception:
                self.price_history = []

    def detect_divergence(self):
        """
        Compare smart money behavior vs price trend.
        Generates divergence signals when they diverge.
        """
        smart_money_ids = self._identify_smart_money()
        if not smart_money_ids:
            self.log.info("No smart money clusters identified yet.")
            return

        # Aggregate smart money accumulation score
        scores = []
        for cid in smart_money_ids:
            cluster = self.clusters.get(cid)
            if cluster:
                scores.append(cluster.get("accumulationScore", 0))

        if not scores:
            return

        avg_smart_score = sum(scores) / len(scores)

        # Determine smart money action
        if avg_smart_score > 30:
            smart_action = "accumulating"
        elif avg_smart_score < -30:
            smart_action = "distributing"
        else:
            smart_action = "neutral"

        # Get price trend (last 6 hours)
        six_hours_ago = time.time() - 6 * 3600
        recent_prices = [
            p for p in self.price_history if p["ts"] >= six_hours_ago
        ]

        if len(recent_prices) < 2:
            self.log.info("Not enough price history for divergence detection.")
            return

        price_start = recent_prices[0]["price"]
        price_end = recent_prices[-1]["price"]

        if price_start == 0:
            return

        price_change_pct = ((price_end - price_start) / price_start) * 100

        if price_change_pct > 2:
            price_trend = "rising"
        elif price_change_pct < -2:
            price_trend = "falling"
        else:
            price_trend = "sideways"

        # Calculate signal strength
        strength = abs(avg_smart_score) * (abs(price_change_pct) / 5)
        strength = min(100, max(0, round(strength)))

        # Detect divergence
        signal_type = None
        description = ""

        if smart_action == "accumulating" and price_trend == "falling":
            signal_type = "bullish_divergence"
            description = (
                f"Smart money clusters are accumulating (score: {avg_smart_score:.0f}) "
                f"while STX price is declining ({price_change_pct:.1f}%). "
                f"Historically indicates potential reversal upward."
            )
        elif smart_action == "distributing" and price_trend == "rising":
            signal_type = "bearish_divergence"
            description = (
                f"Smart money clusters are distributing (score: {avg_smart_score:.0f}) "
                f"while STX price is rising ({price_change_pct:.1f}%). "
                f"Historically indicates potential topping action."
            )
        elif smart_action == "accumulating" and price_trend == "rising":
            signal_type = "confirmation"
            description = (
                f"Smart money behavior confirms uptrend. "
                f"Accumulation (score: {avg_smart_score:.0f}) aligns with "
                f"price increase ({price_change_pct:.1f}%)."
            )
        elif smart_action == "distributing" and price_trend == "falling":
            signal_type = "confirmation"
            description = (
                f"Smart money behavior confirms downtrend. "
                f"Distribution (score: {avg_smart_score:.0f}) aligns with "
                f"price decline ({price_change_pct:.1f}%)."
            )

        if not signal_type or strength < DIVERGENCE_STRENGTH_THRESHOLD:
            return

        signal = {
            "id": f"div-{int(time.time())}-{signal_type[:4]}",
            "type": signal_type,
            "strength": strength,
            "smartMoneyAction": smart_action,
            "priceTrend": price_trend,
            "affectedClusters": smart_money_ids[:5],
            "stxPrice": round(price_end, 4),
            "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "description": description,
            "avgAccumulationScore": round(avg_smart_score),
            "priceChange6hPct": round(price_change_pct, 2),
            "smartMoneyCount": len(smart_money_ids),
        }

        # Post to Sentinel API
        self._post_signal(signal)

        # Publish to Redis for other agents
        self.publish("gauss:divergence_signal", signal)

        # Post as AI insight
        self.post_insight({
            "agent": self.name,
            "type": f"smart_money_{signal_type}",
            "analysis": signal,
        })

        self.log.warning(
            f"DIVERGENCE SIGNAL: {signal_type} | "
            f"strength={strength} | smart_money={smart_action} | "
            f"price={price_trend} ({price_change_pct:+.1f}%)"
        )

    def _post_signal(self, signal: dict):
        """Post divergence signal to Sentinel API."""
        try:
            requests.post(
                f"{self.sentinel_api}/api/divergence-signals",
                json=signal, timeout=10
            )
        except Exception as e:
            self.log.error(f"Signal post error: {e}")

    # ── Cluster Publishing ─────────────────────────────────

    def publish_clusters(self):
        """Store clusters in Redis and push to Sentinel API."""
        if not self.clusters:
            return

        # Store individual clusters in Redis
        cluster_ids = []
        for cluster_id, cluster in self.clusters.items():
            self.redis.setex(
                f"gauss:cluster:{cluster_id}",
                CLUSTER_TTL,
                json.dumps(cluster)
            )
            cluster_ids.append(cluster_id)

            # Store wallet -> cluster mapping
            for wallet in cluster.get("wallets", []):
                self.redis.setex(
                    f"gauss:wallet:{wallet}",
                    CLUSTER_TTL,
                    cluster_id
                )

        # Store cluster index
        self.redis.setex(
            "gauss:clusters:index",
            CLUSTER_TTL,
            json.dumps(cluster_ids)
        )

        # Build summary
        type_counts = defaultdict(int)
        for c in self.clusters.values():
            type_counts[c["type"]] += 1

        # Sort clusters for top lists
        sorted_by_score = sorted(
            self.clusters.values(),
            key=lambda x: x.get("accumulationScore", 0),
            reverse=True
        )

        smart_money_ids = self._identify_smart_money()

        summary = {
            "totalClusters": len(self.clusters),
            "whaleGroups": type_counts.get("whale_group", 0),
            "botNetworks": type_counts.get("bot_network", 0),
            "exchanges": type_counts.get("exchange", 0),
            "marketMakers": type_counts.get("market_maker", 0),
            "retail": type_counts.get("retail", 0),
            "smartMoneyCount": len(smart_money_ids),
            "smartMoneyClusters": smart_money_ids[:10],
            "topAccumulators": [
                c for c in sorted_by_score[:5]
                if c.get("accumulationScore", 0) > 0
            ],
            "topDistributors": [
                c for c in sorted_by_score[-5:]
                if c.get("accumulationScore", 0) < 0
            ],
            "totalWallets": len(self.wallet_graph),
            "lastUpdate": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }

        self.redis.setex(
            "gauss:clusters:summary",
            CLUSTER_TTL,
            json.dumps(summary)
        )

        # Push to Sentinel API
        try:
            requests.post(
                f"{self.sentinel_api}/api/cluster-data",
                json={
                    "summary": summary,
                    "clusters": list(self.clusters.values())[:50],
                },
                timeout=15
            )
        except Exception as e:
            self.log.error(f"Cluster data post error: {e}")

        # Publish update event
        self.publish("gauss:cluster_update", {
            "totalClusters": len(self.clusters),
            "smartMoneyCount": len(smart_money_ids),
        })

        # Post insight
        self.post_insight({
            "agent": self.name,
            "type": "cluster_update",
            "analysis": {
                "total_clusters": len(self.clusters),
                "whale_groups": type_counts.get("whale_group", 0),
                "bot_networks": type_counts.get("bot_network", 0),
                "smart_money": len(smart_money_ids),
                "total_wallets": len(self.wallet_graph),
            }
        })

    # ── Main Cycle ─────────────────────────────────────────

    def cycle_collect(self):
        """Data collection cycle (every POLL_INTERVAL seconds)."""
        self.collect_transfers()

    def cycle_cluster(self):
        """Clustering cycle (every CLUSTER_INTERVAL seconds)."""
        now = time.time()

        # Run clustering
        self.cluster_wallets()

        # Publish results
        self.publish_clusters()

        # Periodic tasks
        # Score snapshot (hourly)
        if now - self.last_score_snapshot >= 3600:
            self._snapshot_scores()

        # Divergence detection (every 5 minutes)
        if now - self.last_divergence_check >= 300:
            self._update_price_history()
            self.detect_divergence()
            self.last_divergence_check = now

        # Data cleanup (every hour)
        self._prune_old_data()

        self.last_cluster_time = now

    def handle_messages(self):
        """Process incoming Redis messages (non-blocking)."""
        msg = self.pubsub.get_message(timeout=0.1)
        if not msg or msg["type"] != "message":
            return

        try:
            data = json.loads(msg["data"])
        except Exception:
            return

        # Handle whale alerts from Satoshi
        if data.get("from") == "satoshi":
            txid = data.get("txid", "")
            amount = data.get("amount", 0)
            analysis = data.get("analysis", {})
            self.log.info(
                f"Whale alert from Satoshi: {amount} STX | "
                f"pattern={analysis.get('pattern', 'unknown')}"
            )

        # Handle orchestrator commands
        if data.get("command") == "scan_clusters":
            self.log.info("Scan command received — running full clustering cycle.")
            self.cycle_cluster()

    def run(self):
        self.log.info("GAUSS active — wallet clustering engine started.")

        # Load persisted data
        self._load_price_history()

        # Schedule tasks
        schedule.every(POLL_INTERVAL).seconds.do(self.cycle_collect)
        schedule.every(CLUSTER_INTERVAL).seconds.do(self.cycle_cluster)

        # First run
        self.cycle_collect()

        while True:
            schedule.run_pending()
            self.handle_messages()
            time.sleep(1)


if __name__ == "__main__":
    agent = GaussAgent()
    agent.run()
