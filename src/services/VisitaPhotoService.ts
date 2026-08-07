import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';
import { sanitizePhoneExportFileName } from '../utils/phoneFileExportCompat';

export type VisitaPhotoOrigin = 'camera' | 'galeria';

export type VisitaPhotoLocal = {
  uri: string;
  nome_original: string;
  mime_type: string;
  tamanho_bytes?: number;
  largura?: number;
  altura?: number;
  origem: VisitaPhotoOrigin;
  criada_em: string;
};

const VISITA_PHOTO_DIRECTORY = 'visita-fotos/';
export const MAX_VISITA_PHOTOS = 8;
export const MAX_VISITA_PHOTO_SIZE_BYTES = 20 * 1024 * 1024;

const mimeFromName = (name: string): string => {
  const extension = name.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  if (extension === 'heic') return 'image/heic';
  if (extension === 'heif') return 'image/heif';
  return 'image/jpeg';
};

const ensurePhotoDirectory = async (): Promise<string> => {
  if (!FileSystem.documentDirectory) {
    throw new Error('O armazenamento do aparelho não está disponível.');
  }
  const directory = `${FileSystem.documentDirectory}${VISITA_PHOTO_DIRECTORY}`;
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true });
  return directory;
};

const persistAsset = async (
  asset: ImagePicker.ImagePickerAsset,
  origin: VisitaPhotoOrigin,
  index: number
): Promise<VisitaPhotoLocal> => {
  const sourceUri = String(asset?.uri || '').trim();
  if (!sourceUri) throw new Error('A imagem selecionada não possui um arquivo válido.');
  if (asset.type && asset.type !== 'image') throw new Error('Selecione somente imagens.');
  if (asset.fileSize != null && asset.fileSize > MAX_VISITA_PHOTO_SIZE_BYTES) {
    throw new Error('Cada foto deve ter no máximo 20 MB.');
  }

  const requestedMime = String(asset.mimeType || '').trim().toLowerCase();
  if (requestedMime && !requestedMime.startsWith('image/')) {
    throw new Error('Selecione somente arquivos de imagem.');
  }

  const originalName = sanitizePhoneExportFileName(
    asset.fileName,
    sourceUri,
    requestedMime || undefined,
    `foto-visita-${index + 1}`
  );
  const mimeType = requestedMime || mimeFromName(originalName);
  const directory = await ensurePhotoDirectory();
  const uniquePrefix = `${Date.now()}-${index + 1}-${Math.random().toString(36).slice(2, 8)}`;
  const destinationUri = `${directory}${uniquePrefix}-${originalName}`;
  await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
  const info = await FileSystem.getInfoAsync(destinationUri);
  if (!info.exists) throw new Error('A foto não pôde ser copiada para o armazenamento do aplicativo.');
  if (typeof info.size === 'number' && info.size > MAX_VISITA_PHOTO_SIZE_BYTES) {
    await FileSystem.deleteAsync(destinationUri, { idempotent: true }).catch(() => undefined);
    throw new Error('Cada foto deve ter no máximo 20 MB.');
  }
  const storedSize = asset.fileSize ?? (typeof info.size === 'number' ? info.size : undefined);

  return {
    uri: destinationUri,
    nome_original: originalName,
    mime_type: mimeType,
    ...(storedSize != null ? { tamanho_bytes: storedSize } : {}),
    ...(asset.width > 0 ? { largura: asset.width } : {}),
    ...(asset.height > 0 ? { altura: asset.height } : {}),
    origem: origin,
    criada_em: new Date().toISOString(),
  };
};

const persistResult = async (
  result: ImagePicker.ImagePickerResult,
  origin: VisitaPhotoOrigin,
  remainingSlots: number
): Promise<VisitaPhotoLocal[]> => {
  if (result.canceled) return [];
  const assets = (result.assets || []).slice(0, Math.max(0, remainingSlots));
  const saved: VisitaPhotoLocal[] = [];

  try {
    for (let index = 0; index < assets.length; index += 1) {
      saved.push(await persistAsset(assets[index], origin, index));
    }
    return saved;
  } catch (error) {
    await Promise.all(saved.map((photo) => deleteVisitaPhotoLocal(photo.uri)));
    throw error;
  }
};

export const captureVisitaPhoto = async (
  currentCount = 0
): Promise<VisitaPhotoLocal[]> => {
  if (currentCount >= MAX_VISITA_PHOTOS) {
    throw new Error(`Cada Visita aceita até ${MAX_VISITA_PHOTOS} fotos.`);
  }
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    throw new Error('Permissão da câmera negada. Autorize a câmera para registrar a foto.');
  }
  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    quality: 0.9,
    exif: false,
    base64: false,
  });
  return persistResult(result, 'camera', 1);
};

export const selectVisitaPhotos = async (
  currentCount = 0
): Promise<VisitaPhotoLocal[]> => {
  const remainingSlots = Math.max(0, MAX_VISITA_PHOTOS - currentCount);
  if (remainingSlots === 0) {
    throw new Error(`Cada Visita aceita até ${MAX_VISITA_PHOTOS} fotos.`);
  }

  if (Platform.OS === 'ios') {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      throw new Error('Permissão de fotos negada. Autorize o acesso para selecionar imagens.');
    }
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: false,
    allowsMultipleSelection: true,
    selectionLimit: remainingSlots,
    quality: 0.9,
    exif: false,
    base64: false,
  });
  return persistResult(result, 'galeria', remainingSlots);
};

export const deleteVisitaPhotoLocal = async (uri: unknown): Promise<boolean> => {
  const normalized = String(uri ?? '').trim();
  const root = FileSystem.documentDirectory
    ? `${FileSystem.documentDirectory}${VISITA_PHOTO_DIRECTORY}`
    : '';
  if (!root || !normalized.startsWith(root) || normalized === root) return false;
  await FileSystem.deleteAsync(normalized, { idempotent: true });
  return true;
};
