import { Linking, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';

const ANDROID_ACTION_VIEW = 'android.intent.action.VIEW';
const FLAG_GRANT_READ_URI_PERMISSION = 1;

const normalizePdfUri = (sourceUri: unknown): string => {
  const normalized = String(sourceUri ?? '').trim();
  return /^(https?:\/\/|file:\/\/|content:\/\/)/i.test(normalized) ? normalized : '';
};

export const openPdfExternally = async (sourceUri: string): Promise<void> => {
  const normalizedSourceUri = normalizePdfUri(sourceUri);
  if (!normalizedSourceUri) throw new Error('invalid_pdf_uri');

  if (Platform.OS === 'android') {
    const sharedUri = /^file:\/\//i.test(normalizedSourceUri)
      ? await FileSystem.getContentUriAsync(normalizedSourceUri)
      : normalizedSourceUri;

    await IntentLauncher.startActivityAsync(ANDROID_ACTION_VIEW, {
      data: sharedUri,
      flags: FLAG_GRANT_READ_URI_PERMISSION,
      type: 'application/pdf',
    });
    return;
  }

  const supported = await Linking.canOpenURL(normalizedSourceUri);
  if (!supported) throw new Error('pdf_viewer_unavailable');
  await Linking.openURL(normalizedSourceUri);
};
