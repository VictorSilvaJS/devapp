import { requireNativeComponent, type HostComponent, type NativeSyntheticEvent, type ViewProps } from 'react-native';

export type PrivacyFocusEvent = { generation: number; focused: boolean };
export type PrivacyNativeProps = ViewProps & {
  releasedGeneration: number;
  onPrivacyFocus: (event: NativeSyntheticEvent<PrivacyFocusEvent>) => void;
};

// RN registers names for the lifetime of the JS runtime. Preserve only this component
// handle across Fast Refresh; no session, callback or business state is retained here.
const registry = globalThis as typeof globalThis & { __tcheHttpPrivacyView?: HostComponent<PrivacyNativeProps> };
export default registry.__tcheHttpPrivacyView ??= requireNativeComponent<PrivacyNativeProps>('HttpPrivacyView');
