import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { RINGTONE_DEFINITIONS } from '../../lib/ringtones';
import { NativeSelect } from '../ui/native-select';

export function RingtoneSelector() {
  const { user, activeMembership } = useAuth();
  const { selectedRingtoneId, setRingtone, previewRingtone } = useSocket();

  if (!user || activeMembership?.role === 'guard') return null;

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setRingtone(id);
    previewRingtone(id);
  };

  return (
    <NativeSelect
      aria-label="Tono de llamada"
      className="h-7 py-0 font-mono text-[11px]"
      value={selectedRingtoneId}
      onChange={handleChange}
    >
      {RINGTONE_DEFINITIONS.map((r) => (
        <option key={r.id} value={r.id}>
          {r.name}
        </option>
      ))}
    </NativeSelect>
  );
}
