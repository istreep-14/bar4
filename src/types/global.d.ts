export {};

declare global {
    interface Window {
      BAR_TRACKER_APP_PORT?: string;
      BAR_TRACKER_CONTROL_ORIGIN?: string;
      Chart?: unknown;
    }

  const gapi: any;
  const google: any;
}
