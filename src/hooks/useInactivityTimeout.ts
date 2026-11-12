import { useEffect, useRef, useState, useCallback } from 'react';

interface UseInactivityTimeoutOptions {
  timeoutMs?: number; // Default 10 minutes (600,000 ms)
  warningMs?: number; // Default 60 seconds warning before logout (60,000 ms)
  isEnabled: boolean;
  onTimeout: () => void;
}

export function useInactivityTimeout({
  timeoutMs = 10 * 60 * 1000, // 10 minutos
  warningMs = 60 * 1000,      // 60 segundos antes de cerrar
  isEnabled,
  onTimeout,
}: UseInactivityTimeoutOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(Math.floor(warningMs / 1000));

  const lastActivityRef = useRef<number>(Date.now());
  const warningTimerRef = useRef<NodeJS.Timeout | null>(null);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarning) {
      setShowWarning(false);
    }
  }, [showWarning]);

  useEffect(() => {
    if (!isEnabled) {
      setShowWarning(false);
      return;
    }

    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
      'wheel',
    ];

    let throttleTimeout: NodeJS.Timeout | null = null;
    const handleUserActivity = () => {
      if (!throttleTimeout) {
        throttleTimeout = setTimeout(() => {
          throttleTimeout = null;
        }, 500);
        lastActivityRef.current = Date.now();
        if (showWarning) {
          setShowWarning(false);
        }
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Check timer every 2 seconds
    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= timeoutMs) {
        // 10 minutes reached: logout
        clearInterval(interval);
        setShowWarning(false);
        sessionStorage.setItem('evaluaciones_logout_reason', 'inactivity');
        onTimeout();
      } else if (elapsed >= timeoutMs - warningMs) {
        // Inside warning window (last 60 seconds)
        const left = Math.max(1, Math.ceil((timeoutMs - elapsed) / 1000));
        setSecondsRemaining(left);
        setShowWarning(true);
      } else {
        setShowWarning(false);
      }
    }, 1000);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      clearInterval(interval);
      if (throttleTimeout) clearTimeout(throttleTimeout);
    };
  }, [isEnabled, timeoutMs, warningMs, onTimeout, showWarning]);

  return {
    showWarning,
    secondsRemaining,
    resetTimer,
  };
}
