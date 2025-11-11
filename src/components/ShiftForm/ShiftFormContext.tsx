// @ts-nocheck
import React, { createContext, useContext } from 'react';

const ShiftFormContext = createContext(null);

export const useShiftFormContext = () => {
  const context = useContext(ShiftFormContext);
  if (!context) {
    throw new Error('useShiftFormContext must be used within a ShiftFormContext.Provider');
  }
  return context;
};

export default ShiftFormContext;
