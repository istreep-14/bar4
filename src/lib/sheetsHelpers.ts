export const COWORKER_SHEET_NAME = 'Coworkers';

export const getSheetsErrorMessage = (error: any, fallback = 'Google Sheets request failed.') => {
  if (!error) return fallback;
  if (typeof error === 'string') return error;
  if (error?.result?.error?.message) return error.result.error.message;
  if (error?.message) return error.message;
  return fallback;
};
