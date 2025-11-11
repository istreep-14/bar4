import { useMemo, useState } from 'react';

export type ShiftFormPage =
  | 'overview'
  | 'timings'
  | 'cuts'
  | 'crew'
  | 'parties'
  | 'enhancements'
  | 'drinking';

export const SHIFT_FORM_PAGES: ShiftFormPage[] = [
  'overview',
  'timings',
  'cuts',
  'crew',
  'parties',
  'enhancements',
  'drinking',
];

export const useShiftForm = () => {
  const [activePage, setActivePage] = useState<ShiftFormPage>('overview');

  const formState = useMemo(
    () => ({
      meta: { notes: '', date: new Date().toISOString().slice(0, 10) },
      time: {},
      tips: {},
    }),
    []
  );

  const updateFormField = (path: string, value: unknown) => {
    console.debug('updateFormField', { path, value });
  };

  return {
    activePage,
    setActivePage,
    formState,
    updateFormField,
    pages: SHIFT_FORM_PAGES,
  };
};
