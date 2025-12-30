import { useState, useEffect } from 'react';

export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 500
): T {
  const [timer, setTimer] = useState<NodeJS.Timeout | null>(null);

  return ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    
    const newTimer = setTimeout(() => {
      callback(...args);
    }, delay);
    
    setTimer(newTimer);
  }) as T;
}

export default useDebounce;
