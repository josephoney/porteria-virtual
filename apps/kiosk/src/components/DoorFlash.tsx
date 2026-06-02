import { useState, useEffect } from 'react';

interface DoorFlashProps {
  trigger: number; // increment to re-trigger
}

export function DoorFlash({ trigger }: DoorFlashProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (trigger === 0) return;
    setVisible(true);
    const id = setTimeout(() => setVisible(false), 2500);
    return () => clearTimeout(id);
  }, [trigger]);

  return (
    <div id="door-flash" className={visible ? 'show' : ''}>
      <div className="door-flash-text">PUERTA ABIERTA</div>
    </div>
  );
}
