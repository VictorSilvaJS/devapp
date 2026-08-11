export type PropriedadeDetailResponsiveLayout = {
  isLandscape: boolean;
  useWideOverview: boolean;
  useWideIndicators: boolean;
  navigationFits: boolean;
  summaryColumns: 1 | 2;
  stackActions: boolean;
};

const normalizeDimension = (value: number) => (
  Number.isFinite(value) && value > 0 ? value : 0
);

export const getPropriedadeDetailResponsiveLayout = (
  width: number,
  height: number
): PropriedadeDetailResponsiveLayout => {
  const safeWidth = normalizeDimension(width);
  const safeHeight = normalizeDimension(height);
  const isLandscape = safeWidth > safeHeight && safeHeight > 0;
  const useWideOverview = isLandscape && safeWidth >= 720;
  const useWideIndicators = safeWidth >= 760;
  const navigationFits = safeWidth >= 780;
  const summaryColumns = safeWidth >= 720 ? 2 : 1;

  return {
    isLandscape,
    useWideOverview,
    useWideIndicators,
    navigationFits,
    summaryColumns,
    stackActions: safeWidth < 600 || useWideOverview,
  };
};
