import { useRef, useState, type ChangeEvent } from 'react';
import { Button } from './button';
import { Label } from './label';

const MAX_LOGO_BYTES = 500 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export function LogoUpload({
  id,
  label,
  previewUrl,
  hasLogo,
  onSelect,
  disabled = false,
  error,
  hint = 'PNG, JPG o WEBP. Máximo 500 KB.',
}: {
  id: string;
  label: string;
  previewUrl: string | null;
  hasLogo: boolean;
  onSelect: (file: File) => void;
  disabled?: boolean;
  error?: string | null;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setValidationError(null);

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setFileName(null);
      setValidationError('El logo debe ser PNG, JPG o WEBP.');
      return;
    }

    if (file.size > MAX_LOGO_BYTES) {
      setFileName(null);
      setValidationError('El logo no puede superar los 500 KB.');
      return;
    }

    setFileName(file.name);
    onSelect(file);
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-4">
        <div className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40 text-center">
          {previewUrl ? (
            <img src={previewUrl} alt={label} className="size-full object-contain" />
          ) : (
            <span className="px-1 text-xs leading-tight text-muted-foreground">
              {hasLogo ? 'Logo cargado' : 'Sin logo'}
            </span>
          )}
        </div>
        <div className="min-w-0 space-y-1">
          <input
            ref={inputRef}
            id={id}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={handleChange}
            disabled={disabled}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={disabled}
          >
            {disabled ? 'Subiendo…' : hasLogo ? 'Cambiar logo' : 'Elegir logo'}
          </Button>
          {fileName && <p className="truncate text-xs text-muted-foreground">{fileName}</p>}
          <p className="text-xs text-muted-foreground">{hint}</p>
          {(validationError || error) && (
            <p className="text-xs text-destructive">{validationError ?? error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
