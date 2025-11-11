import { useCallback } from 'react';

export const useTimeInputs = () => {
  const parseTime = useCallback((value: string) => {
    console.debug('parseTime', value);
    return value;
  }, []);

  const validateTime = useCallback((value: string) => {
    return value.trim().length > 0;
  }, []);

  return {
    parseTime,
    validateTime,
  };
};
