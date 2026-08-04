export type MaterialImageOffset = {
  x: number;
  y: number;
};

type MaterialImageViewport = {
  width: number;
  height: number;
};

type ZoomAroundPointInput = {
  startZoom: number;
  nextZoom: number;
  startOffset: MaterialImageOffset;
  point: MaterialImageOffset;
  viewport: MaterialImageViewport;
};

export const MATERIAL_IMAGE_MIN_ZOOM = 1;
export const MATERIAL_IMAGE_MAX_ZOOM = 4;
export const MATERIAL_IMAGE_DOUBLE_TAP_ZOOM = 2;

const finiteOr = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value));

export const clampMaterialImageZoom = (value: unknown): number =>
  clamp(
    finiteOr(value, MATERIAL_IMAGE_MIN_ZOOM),
    MATERIAL_IMAGE_MIN_ZOOM,
    MATERIAL_IMAGE_MAX_ZOOM
  );

export const clampMaterialImageOffset = (
  offset: MaterialImageOffset,
  zoom: number,
  viewport: MaterialImageViewport
): MaterialImageOffset => {
  const safeZoom = clampMaterialImageZoom(zoom);
  const width = Math.max(0, finiteOr(viewport.width, 0));
  const height = Math.max(0, finiteOr(viewport.height, 0));
  const maxX = width * (safeZoom - 1) / 2;
  const maxY = height * (safeZoom - 1) / 2;

  return {
    x: maxX === 0 ? 0 : clamp(finiteOr(offset.x, 0), -maxX, maxX),
    y: maxY === 0 ? 0 : clamp(finiteOr(offset.y, 0), -maxY, maxY),
  };
};

export const resolveMaterialImageZoomAroundPoint = ({
  startZoom,
  nextZoom,
  startOffset,
  point,
  viewport,
}: ZoomAroundPointInput): MaterialImageOffset => {
  const safeStartZoom = clampMaterialImageZoom(startZoom);
  const safeNextZoom = clampMaterialImageZoom(nextZoom);
  const ratio = safeNextZoom / safeStartZoom;
  const relativeX = finiteOr(point.x, viewport.width / 2) - viewport.width / 2;
  const relativeY = finiteOr(point.y, viewport.height / 2) - viewport.height / 2;

  return clampMaterialImageOffset({
    x: startOffset.x * ratio + relativeX * (1 - ratio),
    y: startOffset.y * ratio + relativeY * (1 - ratio),
  }, safeNextZoom, viewport);
};
