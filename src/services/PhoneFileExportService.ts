import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import {
  resolvePhoneExportCreatedFileName,
  resolvePhoneExportMimeType,
  sanitizePhoneExportFileName,
  splitPhoneExportFileName,
} from '../utils/phoneFileExportCompat';

export type PhoneFileExportResult =
  | { status: 'saved'; fileName: string; destinationUri: string; userSelectedDirectory: boolean }
  | { status: 'cancelled' };

type PhoneFileExportInput = {
  sourceUri: string;
  preferredFileName?: string | null;
  mimeType?: string | null;
  fallbackBaseName?: string;
};

const ensureReadableSource = async (
  sourceUri: string,
  fileName: string
): Promise<{ uri: string; temporary: boolean }> => {
  if (!/^https?:\/\//i.test(sourceUri)) {
    return { uri: sourceUri, temporary: false };
  }

  if (!FileSystem.cacheDirectory) throw new Error('cache_unavailable');
  const baseDir = `${FileSystem.cacheDirectory}tche-export/`;
  await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
  const temporaryUri = `${baseDir}${Date.now()}-${fileName}`;
  const result = await FileSystem.downloadAsync(sourceUri, temporaryUri);
  const info = await FileSystem.getInfoAsync(result.uri);
  if (!info.exists) throw new Error('download_missing');
  return { uri: result.uri, temporary: true };
};

const exportToAndroidDirectory = async (
  readableUri: string,
  fileName: string,
  mimeType: string
): Promise<PhoneFileExportResult> => {
  const saf = FileSystem.StorageAccessFramework;
  let initialDirectoryUri: string | null = null;

  try {
    initialDirectoryUri = saf.getUriForDirectoryInRoot('Download');
  } catch {
    initialDirectoryUri = null;
  }

  const permission = await saf.requestDirectoryPermissionsAsync(initialDirectoryUri);
  if (!permission.granted) return { status: 'cancelled' };

  const { baseName } = splitPhoneExportFileName(fileName);
  const destinationUri = await saf.createFileAsync(
    permission.directoryUri,
    baseName,
    mimeType
  );
  const encoded = await FileSystem.readAsStringAsync(readableUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await FileSystem.writeAsStringAsync(destinationUri, encoded, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const info = await FileSystem.getInfoAsync(destinationUri);
  if (!info.exists) throw new Error('export_missing');

  return {
    status: 'saved',
    fileName: resolvePhoneExportCreatedFileName(destinationUri, fileName),
    destinationUri,
    userSelectedDirectory: true,
  };
};

const exportToAppDirectory = async (
  readableUri: string,
  fileName: string
): Promise<PhoneFileExportResult> => {
  if (!FileSystem.documentDirectory) throw new Error('storage_unavailable');
  const baseDir = `${FileSystem.documentDirectory}arquivos-salvos/`;
  await FileSystem.makeDirectoryAsync(baseDir, { intermediates: true });
  const destinationUri = `${baseDir}${fileName}`;
  await FileSystem.copyAsync({ from: readableUri, to: destinationUri });
  const info = await FileSystem.getInfoAsync(destinationUri);
  if (!info.exists) throw new Error('export_missing');

  return {
    status: 'saved',
    fileName,
    destinationUri,
    userSelectedDirectory: false,
  };
};

export const exportFileToPhone = async ({
  sourceUri,
  preferredFileName,
  mimeType,
  fallbackBaseName = 'arquivo',
}: PhoneFileExportInput): Promise<PhoneFileExportResult> => {
  const normalizedSourceUri = String(sourceUri || '').trim();
  if (!/^(https?:\/\/|file:\/\/|content:\/\/)/i.test(normalizedSourceUri)) {
    throw new Error('invalid_source_uri');
  }

  const normalizedMimeType = resolvePhoneExportMimeType(
    mimeType,
    preferredFileName || normalizedSourceUri
  );
  const fileName = sanitizePhoneExportFileName(
    preferredFileName,
    normalizedSourceUri,
    normalizedMimeType,
    fallbackBaseName
  );
  const readable = await ensureReadableSource(normalizedSourceUri, fileName);

  try {
    return Platform.OS === 'android'
      ? await exportToAndroidDirectory(readable.uri, fileName, normalizedMimeType)
      : await exportToAppDirectory(readable.uri, fileName);
  } finally {
    if (readable.temporary) {
      await FileSystem.deleteAsync(readable.uri, { idempotent: true }).catch(() => undefined);
    }
  }
};
