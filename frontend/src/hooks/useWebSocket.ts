import { useState, useEffect, useRef, useCallback } from 'react';

interface WebSocketEvents {
  swaps: any[];
  alerts: any[];
  liquidity: any[];
}

export function useWebSocket(wsUrl: string) {
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<WebSocketEvents>({
    swaps: [],
    alerts: [],
    liquidity: [],
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    try {
      console.log('Connecting to WebSocket:', wsUrl);
      const ws = new WebSocket(wsUrl);
      
      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        reconnectAttemptsRef.current = 0;

        // Subscribe to channels
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'swaps' }));
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'alerts' }));
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'liquidity' }));

        // Keep-alive ping every 30 seconds
        if (keepAliveRef.current) clearInterval(keepAliveRef.current);
        keepAliveRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message:', data);
          
          if (data.channel && data.data) {
            setEvents((prev) => {
              const channel = data.channel as keyof WebSocketEvents;
              if (channel in prev) {
                return {
                  ...prev,
                  [channel]: [data.data, ...prev[channel]].slice(0, 50),
                };
              }
              return prev;
            });
          }
        } catch (err) {
          console.error('Error parsing WebSocket message:', err);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        wsRef.current = null;
        if (keepAliveRef.current) { clearInterval(keepAliveRef.current); keepAliveRef.current = null; }

        // Always attempt to reconnect with exponential backoff (max 60s)
        const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 60000);
        console.log(`Reconnecting in ${delay}ms (attempt ${reconnectAttemptsRef.current + 1})...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connect();
        }, delay);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      wsRef.current = ws;
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setIsConnected(false);
    }
  }, [wsUrl]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (keepAliveRef.current) clearInterval(keepAliveRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  const subscribe = useCallback((channel: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'subscribe', channel }));
    }
  }, []);

  const unsubscribe = useCallback((channel: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'unsubscribe', channel }));
    }
  }, []);

  return {
    isConnected,
    events,
    subscribe,
    unsubscribe,
  };
}
