export type Reply<T> = { readonly ok: true; readonly data: T } | { readonly ok: false; readonly error: string; readonly status: number };

export async function api<T>(path: string, method = 'GET', body?: unknown, signal?: AbortSignal): Promise<Reply<T>> {
  return fetch(`/api${path}`, { method, credentials: 'same-origin', signal,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then(async response => {
    if (!response.ok) {
      const payload: unknown = await response.json();
      const message = typeof payload === 'object' && payload !== null && 'error' in payload && typeof payload.error === 'string' ? payload.error : `Request failed (${response.status}).`;
      return { ok: false as const, error: message, status: response.status };
    }
    return { ok: true as const, data: await response.json() as T };
  }).catch(() => ({ ok: false as const, error: 'Cannot reach the server. Check your connection and try again.', status: 0 }));
}
