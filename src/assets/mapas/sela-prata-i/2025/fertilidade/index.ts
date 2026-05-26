import type { ImageSourcePropType } from 'react-native';

export const SELA_PRATA_I_FERTILIDADE_2025_ASSET_BASE_URL =
  'asset://mapas/sela-prata-i/2025/fertilidade';

const assetSources: Record<string, ImageSourcePropType> = {
  [`${SELA_PRATA_I_FERTILIDADE_2025_ASSET_BASE_URL}/ph_10a20.png`]:
    require('./ph_10a20.png'),
  [`${SELA_PRATA_I_FERTILIDADE_2025_ASSET_BASE_URL}/ar_10a20.png`]:
    require('./ar_10a20.png'),
  [`${SELA_PRATA_I_FERTILIDADE_2025_ASSET_BASE_URL}/mo_10a20.png`]:
    require('./mo_10a20.png'),
  [`${SELA_PRATA_I_FERTILIDADE_2025_ASSET_BASE_URL}/pp_10a20.png`]:
    require('./pp_10a20.png'),
  [`${SELA_PRATA_I_FERTILIDADE_2025_ASSET_BASE_URL}/kk_10a20.png`]:
    require('./kk_10a20.png'),
};

export const resolveSelaPrataIFertilidadeAssetSource = (
  arquivoUrl?: string | null
): ImageSourcePropType | null => {
  if (!arquivoUrl) return null;
  return assetSources[arquivoUrl] ?? null;
};
