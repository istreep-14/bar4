export {};

declare global {
  interface Window {
    TIP_POOL_APP_PORT?: string;
    TIP_POOL_CONTROL_ORIGIN?: string;
    Chart?: unknown;
  }

  const gapi: any;
  const google: any;
}
