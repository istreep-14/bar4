export type EarningsBreakdown = {
  tips: number;
  wage: number;
  supplement: number;
  total: number;
};

export const calculateEarnings = (): EarningsBreakdown => ({
  tips: 0,
  wage: 0,
  supplement: 0,
  total: 0,
});
