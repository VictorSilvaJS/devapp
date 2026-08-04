export type FazendaMapaPanelMode = 'bottom-sheet' | 'side-panel';

export type FazendaMapaSheetSnap = 'collapsed' | 'medium' | 'expanded';

export type FazendaMapaSheetSnapPoints = Record<FazendaMapaSheetSnap, number>;

type TalhaoPesquisavel = {
  talhao?: string;
  nome?: string;
  cultura_atual?: string;
  tipo_solo?: string;
  safra?: string;
};

const clamp = (value: number, min: number, max: number): number => (
  Math.min(Math.max(value, min), max)
);

const normalizeSearchText = (value: unknown): string => String(value ?? '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase('pt-BR');

export function resolveFazendaMapaPanelMode(
  width: number,
  height: number
): FazendaMapaPanelMode {
  return width >= 720 || width > height ? 'side-panel' : 'bottom-sheet';
}

export function resolveFazendaMapaSidePanelWidth(width: number): number {
  return Math.round(clamp(width * 0.34, 280, 420));
}

export function resolveFazendaMapaSheetSnapPoints(
  height: number,
  safeBottom = 0
): FazendaMapaSheetSnapPoints {
  const usableHeight = Math.max(420, height);
  const collapsed = clamp(112 + safeBottom, 112, usableHeight * 0.24);
  const medium = clamp(usableHeight * 0.43, collapsed + 112, usableHeight * 0.56);
  const expanded = clamp(usableHeight * 0.74, medium + 112, usableHeight - 88);

  return {
    collapsed: Math.round(collapsed),
    medium: Math.round(medium),
    expanded: Math.round(expanded),
  };
}

export function resolveClosestFazendaMapaSheetSnap(
  visibleHeight: number,
  snapPoints: FazendaMapaSheetSnapPoints,
  velocityY = 0
): FazendaMapaSheetSnap {
  const ordered: FazendaMapaSheetSnap[] = ['collapsed', 'medium', 'expanded'];
  const nearestIndex = ordered.reduce((bestIndex, snap, index) => (
    Math.abs(snapPoints[snap] - visibleHeight)
      < Math.abs(snapPoints[ordered[bestIndex]] - visibleHeight)
      ? index
      : bestIndex
  ), 0);

  if (velocityY > 0.75) {
    return ordered[Math.max(0, nearestIndex - 1)];
  }
  if (velocityY < -0.75) {
    return ordered[Math.min(ordered.length - 1, nearestIndex + 1)];
  }

  return ordered[nearestIndex];
}

export function filterFazendaMapaTalhoes<T extends TalhaoPesquisavel>(
  talhoes: T[],
  query: string
): T[] {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return talhoes;

  return talhoes.filter((talhao) => normalizeSearchText([
    talhao.talhao,
    talhao.nome,
    talhao.cultura_atual,
    talhao.tipo_solo,
    talhao.safra,
  ].filter(Boolean).join(' ')).includes(normalizedQuery));
}
