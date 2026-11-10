const dateTime = new Intl.DateTimeFormat('es-AR', {
  dateStyle: 'short',
  timeStyle: 'short',
});

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTime.format(date);
}

export function formatTime(value: string): string {
  return value.slice(0, 5);
}

export function formatRemaining(seconds: number): string {
  return seconds > 0 ? `${seconds}s` : 'actualizando…';
}
