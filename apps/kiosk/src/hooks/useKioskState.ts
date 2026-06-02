import { useState, useRef, useCallback } from 'react';

export type Screen = 'idle' | 'calling' | 'in-call';
export type StatusDot = '' | 'connected' | 'calling' | 'in-call';

export function useKioskState() {
  const [screen, setScreen] = useState<Screen>('idle');
  const [statusDot, setStatusDot] = useState<StatusDot>('');
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [operatorName, setOperatorName] = useState('—');
  const [callTimer, setCallTimer] = useState('00:00');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);

  const startCallTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const s = Math.floor((Date.now() - (startTimeRef.current ?? 0)) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      setCallTimer(`${mm}:${ss}`);
    }, 1000);
  }, []);

  const stopCallTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setCallTimer('00:00');
  }, []);

  const resetCall = useCallback(() => {
    stopCallTimer();
    setScreen('idle');
    setCurrentCallId(null);
    setOperatorName('—');
    setStatusDot('connected');
  }, [stopCallTimer]);

  const startCall = useCallback((callId: string) => {
    setCurrentCallId(callId);
    setScreen('calling');
    setStatusDot('calling');
  }, []);

  const acceptCall = useCallback(
    (opName: string) => {
      setOperatorName(opName);
      setScreen('in-call');
      setStatusDot('in-call');
      startCallTimer();
    },
    [startCallTimer],
  );

  return {
    screen,
    statusDot,
    currentCallId,
    operatorName,
    callTimer,
    setStatusDot,
    setScreen,
    setCurrentCallId,
    setOperatorName,
    startCall,
    acceptCall,
    resetCall,
    stopCallTimer,
    setCallTimer,
  };
}
