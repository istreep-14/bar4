export const SHIFT_CACHE_KEY = 'tipPool.shiftCache.v2';
export const SHIFT_QUEUE_KEY = 'tipPool.shiftQueue.v1';
export const AUTH_TOKEN_KEY = 'tipPool.authToken.v1';
export const CONFIG_STORAGE_KEY = 'tipPoolConfig';
export const REMOTE_CONFIG_PATH = 'config.json';

export function loadStoredAuthToken() {
  try {
    const raw = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.accessToken) return null;
    if (parsed.expiresAt) {
      parsed.expiresAt = Number(parsed.expiresAt);
    }
    return parsed;
  } catch (error) {
    console.warn('Failed to parse stored auth token', error);
    return null;
  }
}

export function storeAuthToken(session: any) {
  try {
    if (!session) {
      localStorage.removeItem(AUTH_TOKEN_KEY);
      return;
    }
    const payload = {
      accessToken: session.accessToken,
      expiresAt: session.expiresAt,
      scope: session.scope,
      receivedAt: Date.now(),
    };
    localStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(payload));
  } catch (error) {
    console.warn('Failed to persist auth token', error);
  }
}

export function clearStoredAuthToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.warn('Failed to clear auth token', error);
  }
}

export function loadCachedShifts() {
  try {
    const raw = localStorage.getItem(SHIFT_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed;
  } catch (error) {
    console.warn('Failed to parse cached shifts', error);
    return null;
  }
}

export function storeCachedShifts(records: any[]) {
  try {
    localStorage.setItem(SHIFT_CACHE_KEY, JSON.stringify(records || []));
  } catch (error) {
    console.warn('Failed to store cached shifts', error);
  }
}

export function loadPendingQueue() {
  try {
    const raw = localStorage.getItem(SHIFT_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch (error) {
    console.warn('Failed to parse pending queue', error);
    return [];
  }
}

export function storePendingQueue(queue: any[]) {
  try {
    localStorage.setItem(SHIFT_QUEUE_KEY, JSON.stringify(queue || []));
  } catch (error) {
    console.warn('Failed to store pending queue', error);
  }
}

export const isOnline = () => (typeof navigator !== 'undefined' ? navigator.onLine : true);
