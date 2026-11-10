interface ErrorViewProps {
  code: string;
  message: string;
  final: boolean;
  onRetry: () => void;
}

export function ErrorView({ code, message, final, onRetry }: ErrorViewProps) {
  return (
    <main className="page">
      <section className="card">
        <p className="eyebrow">Pase de visita</p>
        <h1>{final ? 'No disponible' : 'Algo salió mal'}</h1>
        <p className="lead">{message}</p>
        <p className="code">Código: {code}</p>
        {!final && (
          <button className="primary" type="button" onClick={onRetry}>
            Reintentar
          </button>
        )}
      </section>
    </main>
  );
}
