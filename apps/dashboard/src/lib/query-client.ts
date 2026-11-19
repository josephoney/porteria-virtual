import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './apiClient';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Los datos se consideran frescos por 30 s: al volver a una sección se
      // pinta de inmediato con lo cacheado y se revalida en segundo plano.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // El panel se usa en operación con la ventana siempre al frente: refrescar
      // por foco sólo genera requests que el usuario no pidió.
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        // Un 4xx no se arregla reintentando (permisos, validación, no existe).
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});
