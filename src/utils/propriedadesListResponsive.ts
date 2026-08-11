export type PropriedadesListResponsiveLayout = {
  isLandscape: boolean;
  useWideMetrics: boolean;
};

export const getPropriedadesListResponsiveLayout = (
  width: number,
  height: number,
): PropriedadesListResponsiveLayout => {
  const normalizedWidth = Number.isFinite(width) ? Math.max(width, 0) : 0;
  const normalizedHeight = Number.isFinite(height) ? Math.max(height, 0) : 0;
  const isLandscape = normalizedWidth > normalizedHeight && normalizedHeight > 0;

  return {
    isLandscape,
    useWideMetrics: isLandscape && normalizedWidth >= 720,
  };
};

export const getPropriedadesWideMetricCardWidth = (
  width: number,
  cardCount = 5,
  gap = 12,
  horizontalPadding = 16,
): number => {
  const normalizedWidth = Number.isFinite(width) ? Math.max(width, 0) : 0;
  const normalizedCount = Number.isFinite(cardCount) ? Math.max(Math.floor(cardCount), 1) : 1;
  const normalizedGap = Number.isFinite(gap) ? Math.max(gap, 0) : 0;
  const normalizedPadding = Number.isFinite(horizontalPadding) ? Math.max(horizontalPadding, 0) : 0;
  const availableWidth = normalizedWidth
    - (normalizedPadding * 2)
    - (normalizedGap * (normalizedCount - 1));

  return Math.max(availableWidth / normalizedCount, 0);
};
