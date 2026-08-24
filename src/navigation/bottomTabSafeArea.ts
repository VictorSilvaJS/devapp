const BASE_TAB_BAR_HEIGHT = 65;
const BASE_TAB_BAR_BOTTOM_PADDING = 4;

export type BottomTabSafeAreaLayout = {
  readonly height: number;
  readonly paddingBottom: number;
};

/** Preserva a área visual da barra e reserva o espaço dos gestos do sistema. */
export function resolveBottomTabSafeArea(
  bottomInset: number,
): BottomTabSafeAreaLayout {
  const safeBottomInset = Number.isFinite(bottomInset)
    ? Math.max(0, bottomInset)
    : 0;

  return {
    height: BASE_TAB_BAR_HEIGHT + safeBottomInset,
    paddingBottom: BASE_TAB_BAR_BOTTOM_PADDING + safeBottomInset,
  };
}
