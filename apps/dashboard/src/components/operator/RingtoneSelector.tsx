import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { RINGTONE_DEFINITIONS } from '../../lib/ringtones';

export function RingtoneSelector() {
  const { user } = useAuth();
  const { selectedRingtoneId, setRingtone, previewRingtone } = useSocket();

  if (!user || user.role === 'guard') return null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setRingtone(id);
    previewRingtone(id);
  };

  return (
    <select
      className="px-2 py-1 rounded border border-border bg-card text-foreground font-mono text-[11px] cursor-pointer outline-none focus:border-ring"
      value={selectedRingtoneId}
      onChange={handleChange}
    >
      {RINGTONE_DEFINITIONS.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </select>
  );
}
