import { useCallback, useEffect, useState } from 'react';
import type { PublicPassPreview } from '@porteria/shared';
import { ApiError, bindPass, getPreview, getStatus } from './api';
import { ErrorView } from './components/ErrorView';
import { PassList } from './components/PassList';
import { PinForm } from './components/PinForm';
import { PreviewCard } from './components/PreviewCard';
import { QrView } from './components/QrView';
import { FINAL_CODES, messageFor } from './lib/messages';

type Screen = 'loading' | 'preview' | 'pin' | 'qr' | 'error';

const LIST_PATH = '/p/mis-pases';

type Route = { kind: 'pass'; token: string } | { kind: 'list' } | { kind: 'invalid' };

function readRoute(): Route {
  const path = window.location.pathname.replace(/\/+$/, '');
  if (path === LIST_PATH) return { kind: 'list' };

  const match = path.match(/^\/p\/([^/]+)$/);
  if (match) return { kind: 'pass', token: decodeURIComponent(match[1]) };

  return { kind: 'invalid' };
}

export default function App() {
  const route = readRoute();

  if (route.kind === 'list') return <PassList />;

  if (route.kind === 'invalid') {
    return (
      <ErrorView
        code="not_found"
        message={messageFor('not_found')}
        final
        onRetry={() => undefined}
      />
    );
  }

  return <PassScreen token={route.token} />;
}

function PassScreen({ token }: { token: string }) {
  const [screen, setScreen] = useState<Screen>('loading');
  const [preview, setPreview] = useState<PublicPassPreview | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setScreen('loading');
    setErrorCode(null);

    void (async () => {
      try {
        const data = await getPreview(token);
        if (cancelled) return;
        setPreview(data);

        try {
          const status = await getStatus(token);
          if (cancelled) return;
          if (status.status !== 'active') {
            setErrorCode(status.status === 'used' ? 'pass_used' : status.status);
            setScreen('error');
            return;
          }
          setScreen('qr');
        } catch (error) {
          if (cancelled) return;
          if (error instanceof ApiError && error.code === 'not_bound') {
            setScreen(data.pinRequired ? 'pin' : 'preview');
            return;
          }
          throw error;
        }
      } catch (error) {
        if (cancelled) return;
        setErrorCode(error instanceof ApiError ? error.code : 'request_failed');
        setScreen('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, attempt]);

  const handleBind = useCallback(
    async (pin?: string) => {
      setBusy(true);
      setErrorCode(null);

      try {
        await bindPass(token, pin);
        const status = await getStatus(token);
        if (status.status !== 'active') {
          setErrorCode(status.status === 'used' ? 'pass_used' : status.status);
          setScreen('error');
          return;
        }
        setScreen('qr');
      } catch (error) {
        const code = error instanceof ApiError ? error.code : 'request_failed';
        setErrorCode(code);
        if (code === 'invalid_pin' || code === 'pin_locked') setScreen('pin');
        else setScreen('error');
      } finally {
        setBusy(false);
      }
    },
    [token],
  );

  const handleExit = useCallback((code: string) => {
    setErrorCode(code);
    setScreen('error');
  }, []);

  if (screen === 'loading') {
    return (
      <main className="page">
        <section className="card loading-card">
          <span className="spinner" aria-hidden="true" />
          <p className="lead">Cargando tu pase…</p>
        </section>
      </main>
    );
  }

  if (screen === 'error') {
    const code = errorCode ?? 'request_failed';
    return (
      <ErrorView
        code={code}
        message={messageFor(code)}
        final={FINAL_CODES.has(code)}
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  if (!preview) {
    return (
      <ErrorView
        code="not_found"
        message={messageFor('not_found')}
        final
        onRetry={() => setAttempt((value) => value + 1)}
      />
    );
  }

  if (screen === 'pin') {
    return (
      <PinForm
        preview={preview}
        busy={busy}
        error={errorCode ? messageFor(errorCode) : null}
        locked={errorCode === 'pin_locked'}
        onSubmit={handleBind}
      />
    );
  }

  if (screen === 'qr') {
    return <QrView token={token} preview={preview} onExit={handleExit} />;
  }

  return (
    <PreviewCard
      preview={preview}
      busy={busy}
      error={errorCode ? messageFor(errorCode) : null}
      onBind={() => {
        void handleBind();
      }}
    />
  );
}
