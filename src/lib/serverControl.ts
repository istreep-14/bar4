const defaultPort = 8000;

export const APP_SERVER_PORT =
  typeof window !== 'undefined' && typeof window.TIP_POOL_APP_PORT === 'string'
    ? parseInt(window.TIP_POOL_APP_PORT, 10) || defaultPort
    : defaultPort;

export const CONTROL_SERVER_ORIGIN =
  typeof window !== 'undefined' && typeof window.TIP_POOL_CONTROL_ORIGIN === 'string'
    ? window.TIP_POOL_CONTROL_ORIGIN
    : 'http://localhost:4100';

export const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function fetchControlServerStatus(): Promise<
  | { ok: true; body: any }
  | { ok: false; error: Error }
> {
  try {
    const response = await fetch(`${CONTROL_SERVER_ORIGIN}/server/status`, { mode: 'cors' });
    if (!response.ok) {
      return { ok: false, error: new Error(`Status ${response.status}`) };
    }
    const body = await response.json();
    return { ok: true, body };
  } catch (error) {
    return { ok: false, error: error as Error };
  }
}

export async function ensureAppServerRunning(options: { retries?: number; waitMs?: number } = {}) {
  const { retries = 3, waitMs = 600 } = options;
  let lastStatus: any = null;
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const statusResult = await fetchControlServerStatus();
    if (statusResult.ok && statusResult.body?.running) {
      return { ok: true, status: statusResult.body, attempts: attempt + 1 };
    }

    if ('error' in statusResult) {
      lastError = statusResult.error;
    } else {
      lastStatus = statusResult.body;
    }

    try {
      await fetch(`${CONTROL_SERVER_ORIGIN}/server/start`, {
        method: 'POST',
        mode: 'cors',
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      lastError = error as Error;
    }

    await wait(waitMs * (attempt + 1));
  }

  return { ok: false, status: lastStatus, error: lastError };
}
