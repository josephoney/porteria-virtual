import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '../ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Changing this value clears a previous error. Pass the pathname. */
  resetKey?: string;
  /** Use the full-viewport fallback when the dashboard shell is unavailable. */
  fullPage?: boolean;
  title?: string;
}

interface ErrorBoundaryState {
  error: Error | null;
}

interface ErrorFallbackProps {
  error: Error;
  title: string;
  fullPage: boolean;
  onRetry: () => void;
}

function ErrorFallback({ error, title, fullPage, onRetry }: ErrorFallbackProps) {
  return (
    <div
      className={
        fullPage
          ? 'flex min-h-screen items-center justify-center bg-background p-6'
          : 'flex h-full items-center justify-center p-6'
      }
    >
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-border bg-card p-6">
        <div className="space-y-2">
          <h1 className="font-heading text-lg font-bold tracking-tight text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">
            Algo falló al mostrar esta pantalla. Podés reintentar o recargar la página.
          </p>
        </div>

        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 font-mono text-xs break-words text-foreground">
          {error.message || 'Error desconocido'}
        </p>

        {import.meta.env.DEV && error.stack && (
          <pre className="max-h-56 overflow-auto rounded-lg border border-border bg-muted/40 p-3 font-mono text-[11px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
            {error.stack}
          </pre>
        )}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={onRetry}>
            Reintentar
          </Button>
          <Button type="button" variant="outline" onClick={() => window.location.reload()}>
            Recargar
          </Button>
        </div>
      </div>
    </div>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error no controlado en el dashboard', error, info.componentStack);
  }

  componentDidUpdate(previous: ErrorBoundaryProps) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <ErrorFallback
        error={error}
        title={this.props.title ?? 'Algo salió mal'}
        fullPage={Boolean(this.props.fullPage)}
        onRetry={this.retry}
      />
    );
  }
}
