interface RequestMetric {
  count: number;
  durationMs: number;
  errors: number;
}

const requests = new Map<string, RequestMetric>();
const startedAt = Date.now();

export function recordRequest(method: string, statusCode: number, durationMs: number): void {
  const key = `${method}:${statusCode}`;
  const current = requests.get(key) ?? { count: 0, durationMs: 0, errors: 0 };
  current.count += 1;
  current.durationMs += durationMs;
  if (statusCode >= 500) current.errors += 1;
  requests.set(key, current);
}

export function renderMetrics(): string {
  const lines: string[] = [];

  lines.push('# HELP porteria_http_requests_total Total HTTP requests');
  lines.push('# TYPE porteria_http_requests_total counter');
  for (const [key, value] of requests) {
    const [method, status] = key.split(':');
    lines.push(
      `porteria_http_requests_total{method="${method}",status="${status}"} ${value.count}`,
    );
  }

  lines.push('# HELP porteria_http_request_duration_ms Total request duration in milliseconds');
  lines.push('# TYPE porteria_http_request_duration_ms counter');
  for (const [key, value] of requests) {
    const [method, status] = key.split(':');
    lines.push(
      `porteria_http_request_duration_ms{method="${method}",status="${status}"} ${value.durationMs.toFixed(2)}`,
    );
  }

  lines.push('# HELP porteria_http_errors_total Total 5xx responses');
  lines.push('# TYPE porteria_http_errors_total counter');
  for (const [key, value] of requests) {
    const [method, status] = key.split(':');
    lines.push(`porteria_http_errors_total{method="${method}",status="${status}"} ${value.errors}`);
  }

  lines.push('# HELP porteria_process_uptime_seconds Process uptime in seconds');
  lines.push('# TYPE porteria_process_uptime_seconds gauge');
  lines.push(`porteria_process_uptime_seconds ${((Date.now() - startedAt) / 1000).toFixed(3)}`);

  return `${lines.join('\n')}\n`;
}

export function resetMetrics(): void {
  requests.clear();
}
