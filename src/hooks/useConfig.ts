// @ts-nocheck
import { useEffect, useState } from 'react';

type AppConfig = {
  clientId: string;
  apiKey: string;
  spreadsheetId: string;
  sheetName?: string;
};

const CONFIG_PATH = '/config.json';

export const useConfig = () => {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchConfig = async () => {
      try {
        const response = await fetch(CONFIG_PATH, { cache: 'no-store' });
        if (!response.ok) {
          throw new Error(`Failed to load config (${response.status})`);
        }
        const data = await response.json();
        if (!cancelled) {
          setConfig({
            clientId: data.clientId || '',
            apiKey: data.apiKey || '',
            spreadsheetId: data.spreadsheetId || '',
            sheetName: data.sheetName || 'Shifts',
          });
          setError(null);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || 'Unable to load config');
          setConfig(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  return { config, loading, error };
};
