import generatedGeometry from '../assets/geojson/generated/mockV2DemoTalhoes.geojson.json';
import type { MockV2State } from '../domain/contractsV2';

interface GeneratedGeometryFeature {
  id: string;
  properties: {
    geometria_id: string;
    propriedade_id: string;
    talhao_id: string;
    talhao_nome: string;
    area_mapeada_ha: number;
    partes: number;
    fonte: string;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: any;
  };
}

interface GeneratedGeometryCollection {
  type: 'FeatureCollection';
  name: string;
  features: GeneratedGeometryFeature[];
}

const geometryCollection = generatedGeometry as unknown as GeneratedGeometryCollection;
const COLORS = ['#22C55E', '#3B82F6', '#F59E0B', '#A855F7', '#06B6D4', '#F97316'];

const toPoint = (coordinate: number[]) => ({ lat: coordinate[1], lng: coordinate[0] });

const toPolygonParts = (feature: GeneratedGeometryFeature) => {
  const polygonCoordinates = feature.geometry.type === 'Polygon'
    ? [feature.geometry.coordinates]
    : feature.geometry.coordinates;

  return polygonCoordinates
    .map((polygon: number[][][]) => polygon?.[0]?.map(toPoint) || [])
    .filter((polygon: Array<{ lat: number; lng: number }>) => polygon.length >= 4);
};

export const buildMockV2LimitesArea = (state: MockV2State): any[] => {
  const talhaoIds = new Set(state.talhoes.map((talhao) => talhao.id));
  const propriedadeIds = new Set(state.propriedades.map((propriedade) => propriedade.id));

  return geometryCollection.features.flatMap((feature, index) => {
    const properties = feature.properties;
    if (!talhaoIds.has(properties.talhao_id) || !propriedadeIds.has(properties.propriedade_id)) {
      return [];
    }

    const poligonos = toPolygonParts(feature);
    if (poligonos.length === 0) return [];

    return [{
      id: properties.geometria_id,
      propriedade_id: properties.propriedade_id,
      talhao_id: properties.talhao_id,
      talhao_nome: properties.talhao_nome,
      nome: `Limite 2026 - ${properties.talhao_nome}`,
      ano: 2026,
      area_hectares: properties.area_mapeada_ha,
      poligono: poligonos[0],
      poligonos,
      cor: COLORS[index % COLORS.length],
      data_upload: '2026-08-05T00:00:00.000Z',
      safra: '2026/2027',
      disponivel_offline: true,
      observacoes: `Geometria demonstrativa derivada de ${properties.fonte}.`,
    }];
  });
};

export const MOCK_V2_TALHAO_GEOMETRY_COUNT = geometryCollection.features.length;

