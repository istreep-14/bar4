import { useMemo } from 'react';

type Cut = {
  id: string;
  label: string;
  status: 'pending' | 'confirmed';
  amount: string;
};

export const useCuts = () => {
  const cuts = useMemo<Cut[]>(
    () => [
      { id: 'cut-1', label: 'House', status: 'confirmed', amount: '$40.00' },
      { id: 'cut-2', label: 'Support', status: 'pending', amount: '$25.00' },
    ],
    []
  );

  const recordCut = (id: string, amount: string) => {
    console.debug('recordCut', { id, amount });
  };

  return {
    cuts,
    recordCut,
  };
};
