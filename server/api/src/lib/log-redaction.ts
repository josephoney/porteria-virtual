const PUBLIC_PASS_PATH = /\/api\/public\/passes\/[^/?#]+/g;

export function redactSensitiveUrl(url: string): string {
  return url.replace(PUBLIC_PASS_PATH, '/api/public/passes/:token');
}
