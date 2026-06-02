import { useState, useEffect } from 'react';

export function useClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    function tick() {
      setTime(
        new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
      );
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return time;
}
