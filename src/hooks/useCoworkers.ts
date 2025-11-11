import { useMemo } from 'react';

type Coworker = {
  id: string;
  name: string;
  role: string;
  start?: string;
  end?: string;
};

export const useCoworkers = () => {
  const coworkers = useMemo<Coworker[]>(
    () => [
      { id: 'bartender-1', name: 'Morgan', role: 'Bartender', start: '16:00', end: '23:30' },
      { id: 'server-1', name: 'Avery', role: 'Server', start: '17:00', end: '22:15' },
    ],
    []
  );

  const addCoworker = (role: string) => {
    console.debug('addCoworker', role);
  };

  return {
    coworkers,
    addCoworker,
  };
};
