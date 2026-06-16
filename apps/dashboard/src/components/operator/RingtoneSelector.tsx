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
      className="ringtone-select"
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
