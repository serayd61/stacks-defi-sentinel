import { useCallback, useRef } from 'react';

const API_URL =
  import.meta.env.VITE_API_URL ||
  'https://stacks-defi-sentinel-production.up.railway.app';

export function useTrackEvent() {
  const sessionId = useRef(
    `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  );

  const track = useCallback(
    (
      eventName: string,
      payload?: Partial<{ value: number; walletAddress: string }>,
    ) => {
      const body = {
        eventName,
        timestamp: Date.now(),
        sessionId: sessionId.current,
        walletAddress: payload?.walletAddress,
        value: payload?.value,
        context: {
          path: window.location.pathname,
          userAgent: navigator.userAgent,
        },
      };

      fetch(`${API_URL}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }).catch(() => {
        // silently ignore tracking errors
      });
    },
    [],
  );

  return { track };
}
