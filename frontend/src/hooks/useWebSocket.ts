import { useEffect, useRef, useState, useCallback } from 'react';

interface WebSocketMessage {
  type: string;
  channel?: string;
  data?: any;
  timestamp?: number;
}

interface UseWebSocketReturn {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  events: {
    swaps: any[];
    liquidity: any[];
    transfers: any[];
    alerts: any[];
  };
}

export function useWebSocket(url: string): UseWebSocketReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const [events, setEvents] = useState({
    swaps: [] as any[],
    liquidity: [] as any[],
    transfers: [] as any[],
    alerts: [] as any[],
  });
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const connect = useCallback(() => {
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        
        // Subscribe to all events
        ws.send(JSON.stringify({ type: 'subscribe', channel: 'all' }));
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          setLastMessage(message);

          if (message.type === 'event' && message.data) {
            setEvents((prev) => {
              const newEvents = { ...prev };
              
              switch (message.channel) {
                case 'swap':
                  newEvents.swaps = [message.data, ...prev.swaps].slice(0, 50);
                  break;
                case 'liquidity':
                  newEvents.liquidity = [message.data, ...prev.liquidity].slice(0, 50);
                  break;
                case 'transfer':
                  newEvents.transfers = [message.data, ...prev.transfers].slice(0, 50);
                  break;
                case 'whale-alert':
                  newEvents.alerts = [message.data, ...prev.alerts].slice(0, 20);
                  break;
                case 'all':
                  if (message.data.type === 'whale-alert') {
                    newEvents.alerts = [message.data.data, ...prev.alerts].slice(0, 20);
                  }
                  break;
              }
              
              return newEvents;
            });
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message', e);
        }
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        
        // Reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [url]);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
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
    lastMessage,
    subscribe,
    unsubscribe,
    events,
  };
}

