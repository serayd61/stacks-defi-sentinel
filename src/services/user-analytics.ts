import { logger } from '../utils/logger';

// ── Types ──────────────────────────────────────────────────────────────────────

type UserEventName =
  | 'page_view'
  | 'wallet_connected'
  | 'swap_completed'
  | 'liquidity_added'
  | 'liquidity_removed'
  | 'stake_deposited'
  | 'stake_withdrawn';

export interface UserEvent {
  id: string;
  walletAddress?: string;
  sessionId?: string;
  eventName: UserEventName;
  value?: number;
  currency?: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface DailyMetric {
  date: string; // YYYY-MM-DD
  dau: number;
  newUsers: number;
  revenue: number;
  txVolume: number;
}

export interface FunnelStepStat {
  stepIndex: number;
  stepName: string;
  usersReached: number;
  conversionFromPrev: number; // 0-1
}

// ── In-memory stores ───────────────────────────────────────────────────────────

const userEvents: UserEvent[] = [];
const dailyMetrics: Map<string, DailyMetric> = new Map();
const knownUsersByDay: Map<string, Set<string>> = new Map();
const firstSeen: Map<string, string> = new Map();

// ── Core functions ─────────────────────────────────────────────────────────────

export function recordUserEvent(event: UserEvent): void {
  userEvents.push(event);

  const date = new Date(event.timestamp).toISOString().slice(0, 10);
  const metric = dailyMetrics.get(date) ?? {
    date,
    dau: 0,
    newUsers: 0,
    revenue: 0,
    txVolume: 0,
  };

  if (event.walletAddress) {
    let daySet = knownUsersByDay.get(date);
    if (!daySet) {
      daySet = new Set();
      knownUsersByDay.set(date, daySet);
    }

    if (!daySet.has(event.walletAddress)) {
      daySet.add(event.walletAddress);
      metric.dau = daySet.size;
    }

    if (!firstSeen.has(event.walletAddress)) {
      firstSeen.set(event.walletAddress, date);
      metric.newUsers += 1;
    }
  }

  const value = event.value ?? 0;
  if (value > 0) {
    if (
      event.eventName === 'swap_completed' ||
      event.eventName === 'liquidity_added'
    ) {
      metric.txVolume += value;
    }
    if (
      event.eventName === 'swap_completed' ||
      event.eventName === 'stake_deposited'
    ) {
      metric.revenue += value * 0.003; // 0.3% protocol fee
    }
  }

  dailyMetrics.set(date, metric);
}

export function getOverview(from: string, to: string) {
  const fromDate = new Date(from);
  const toDate = new Date(to);

  const days: DailyMetric[] = [];
  const cursor = new Date(fromDate);

  while (cursor <= toDate) {
    const d = cursor.toISOString().slice(0, 10);
    const m = dailyMetrics.get(d) ?? {
      date: d,
      dau: 0,
      newUsers: 0,
      revenue: 0,
      txVolume: 0,
    };
    days.push(m);
    cursor.setDate(cursor.getDate() + 1);
  }

  const summary = days.reduce(
    (acc, d) => {
      acc.totalRevenue += d.revenue;
      acc.totalTxVolume += d.txVolume;
      acc.avgDau += d.dau;
      acc.totalNewUsers += d.newUsers;
      return acc;
    },
    { totalRevenue: 0, totalTxVolume: 0, avgDau: 0, totalNewUsers: 0 },
  );

  if (days.length > 0) {
    summary.avgDau = Math.round(summary.avgDau / days.length);
  }

  return { days, summary };
}

export function getAcquisitionFunnel(
  from: string,
  to: string,
): FunnelStepStat[] {
  const fromTs = new Date(from).getTime();
  const toTs = new Date(to).getTime();

  const filtered = userEvents.filter(
    (e) => e.timestamp >= fromTs && e.timestamp <= toTs,
  );

  const steps: { name: string; event: UserEventName }[] = [
    { name: 'Page View', event: 'page_view' },
    { name: 'Wallet Connected', event: 'wallet_connected' },
    { name: 'First Swap', event: 'swap_completed' },
    { name: 'Liquidity Added', event: 'liquidity_added' },
  ];

  // Group events by wallet (or sessionId for page_views without wallet)
  const userMap = new Map<string, Set<UserEventName>>();
  for (const e of filtered) {
    const key = e.walletAddress || e.sessionId || 'anonymous';
    let eventSet = userMap.get(key);
    if (!eventSet) {
      eventSet = new Set();
      userMap.set(key, eventSet);
    }
    eventSet.add(e.eventName);
  }

  const stepUsers: number[] = steps.map((s) => {
    let count = 0;
    userMap.forEach((events) => {
      if (events.has(s.event)) count++;
    });
    return count;
  });

  return steps.map((s, i) => {
    const usersReached = stepUsers[i];
    const prevUsers = i === 0 ? usersReached : stepUsers[i - 1];
    const conversionFromPrev =
      prevUsers === 0 ? 0 : usersReached / prevUsers;

    return {
      stepIndex: i,
      stepName: s.name,
      usersReached,
      conversionFromPrev: Math.round(conversionFromPrev * 1000) / 1000,
    };
  });
}

// ── Demo data seeder ───────────────────────────────────────────────────────────

function randomWallet(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'SP';
  for (let i = 0; i < 10; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function seedDemoData(): void {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;

  // Create a pool of 200 wallets
  const walletPool: string[] = [];
  for (let i = 0; i < 200; i++) {
    walletPool.push(randomWallet());
  }

  // Generate 30 days of data
  for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
    const dayBase = now - dayOffset * DAY;

    // Trend: more users as days go by (growth)
    const growthFactor = 1 + (29 - dayOffset) * 0.03;

    // Daily unique visitors (page_view): 80-150
    const visitorCount = Math.floor(
      (80 + Math.random() * 70) * growthFactor,
    );

    // Pick random wallets for this day
    const dailyWallets = walletPool
      .sort(() => Math.random() - 0.5)
      .slice(0, Math.min(visitorCount, walletPool.length));

    for (const wallet of dailyWallets) {
      const ts = dayBase + Math.floor(Math.random() * DAY);

      // Everyone gets a page_view
      recordUserEvent({
        id: randomId(),
        walletAddress: wallet,
        sessionId: `sess_${randomId()}`,
        eventName: 'page_view',
        timestamp: ts,
      });

      // 35-50% connect wallet
      if (Math.random() < 0.35 + (29 - dayOffset) * 0.005) {
        recordUserEvent({
          id: randomId(),
          walletAddress: wallet,
          eventName: 'wallet_connected',
          timestamp: ts + 5000,
        });

        // 25-40% of connected do a swap
        if (Math.random() < 0.25 + (29 - dayOffset) * 0.005) {
          const swapValue =
            100 + Math.random() * 9900; // $100 - $10,000
          recordUserEvent({
            id: randomId(),
            walletAddress: wallet,
            eventName: 'swap_completed',
            value: swapValue,
            currency: 'USD',
            timestamp: ts + 15000,
          });

          // 15% of swappers add liquidity
          if (Math.random() < 0.15) {
            const lpValue =
              500 + Math.random() * 19500; // $500 - $20,000
            recordUserEvent({
              id: randomId(),
              walletAddress: wallet,
              eventName: 'liquidity_added',
              value: lpValue,
              currency: 'USD',
              timestamp: ts + 30000,
            });
          }

          // 10% stake
          if (Math.random() < 0.1) {
            const stakeValue =
              200 + Math.random() * 4800;
            recordUserEvent({
              id: randomId(),
              walletAddress: wallet,
              eventName: 'stake_deposited',
              value: stakeValue,
              currency: 'USD',
              timestamp: ts + 45000,
            });
          }
        }
      }
    }
  }

  logger.info(
    `Seeded ${userEvents.length} demo user events across 30 days`,
  );
}
