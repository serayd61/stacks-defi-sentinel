import { logger } from '../utils/logger';

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
  date: string;
  dau: number;
  newUsers: number;
  revenue: number;
  txVolume: number;
}

export interface FunnelStepStat {
  stepIndex: number;
  stepName: string;
  usersReached: number;
  conversionFromPrev: number;
}

// In-memory stores
const userEvents: UserEvent[] = [];
const dailyMetrics: Map<string, DailyMetric> = new Map();
const knownUsersByDay: Map<string, Set<string>> = new Map();
const firstSeen: Map<string, string> = new Map();

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

  // DAU & new users
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

  // Revenue & volume
  const value = event.value ?? 0;
  if (value > 0) {
    if (
      event.eventName === 'swap_completed' ||
      event.eventName === 'liquidity_added'
    ) {
      metric.txVolume += value;
    }
    if (event.eventName === 'stake_deposited') {
      metric.revenue += value;
    }
  }

  dailyMetrics.set(date, metric);
  logger.debug(`Recorded user event: ${event.eventName} (${event.id})`);
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
    summary.avgDau = summary.avgDau / days.length;
  }

  return { days, summary };
}

export function getAcquisitionFunnel(from: string, to: string): FunnelStepStat[] {
  const fromTs = new Date(from).getTime();
  const toTs = new Date(to).getTime();

  const filtered = userEvents.filter(
    (e) => e.timestamp >= fromTs && e.timestamp <= toTs && e.walletAddress,
  );

  const steps: { name: string; event: UserEventName }[] = [
    { name: 'Page View', event: 'page_view' },
    { name: 'Wallet Connected', event: 'wallet_connected' },
    { name: 'First Swap', event: 'swap_completed' },
  ];

  const stepUsers: Set<string>[] = steps.map(() => new Set());

  const eventsByWallet = new Map<string, UserEvent[]>();
  filtered.forEach((e) => {
    const wallet = e.walletAddress!;
    const list = eventsByWallet.get(wallet) ?? [];
    list.push(e);
    eventsByWallet.set(wallet, list);
  });

  eventsByWallet.forEach((events, wallet) => {
    const names = new Set(events.map((e) => e.eventName));
    steps.forEach((s, idx) => {
      if (names.has(s.event)) {
        stepUsers[idx].add(wallet);
      }
    });
  });

  const stats: FunnelStepStat[] = steps.map((s, i) => {
    const usersReached = stepUsers[i].size;
    const prevUsers = i === 0 ? usersReached : stepUsers[i - 1].size;
    const conversionFromPrev = prevUsers === 0 ? 0 : usersReached / prevUsers;
    return {
      stepIndex: i,
      stepName: s.name,
      usersReached,
      conversionFromPrev,
    };
  });

  return stats;
}
