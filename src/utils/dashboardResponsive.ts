export type DashboardResponsiveLayout = {
  isLandscape: boolean;
  standardColumns: number;
  produtorColumns: number;
  splitProdutorOverview: boolean;
};

const normalizeDimension = (value: number) => (
  Number.isFinite(value) && value > 0 ? value : 0
);

export const getDashboardResponsiveLayout = (
  width: number,
  height: number
): DashboardResponsiveLayout => {
  const safeWidth = normalizeDimension(width);
  const safeHeight = normalizeDimension(height);
  const isLandscape = safeWidth > safeHeight && safeHeight > 0;

  return {
    isLandscape,
    standardColumns: isLandscape && safeWidth >= 840 ? 3 : 2,
    produtorColumns: 2,
    splitProdutorOverview: isLandscape && safeWidth >= 720,
  };
};

export const getDashboardColumnWidth = (columns: number): `${number}%` => {
  const safeColumns = Number.isFinite(columns)
    ? Math.max(1, Math.floor(columns))
    : 1;

  return `${100 / safeColumns}%`;
};
