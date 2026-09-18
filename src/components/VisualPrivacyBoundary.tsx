import React from 'react';
import { Platform, View, type ViewProps } from 'react-native';
import type { PrivacyFocusEvent, PrivacyNativeProps } from './HttpPrivacyNativeView';

type PrivacyPolicy = { covered: boolean; validateReturn: () => Promise<void> };
// Injected presentation policy: Demo never mounts or loads the native view.
export const VisualPrivacyContext = React.createContext<PrivacyPolicy | null>(null);
let NativePrivacyView: React.ComponentType<PrivacyNativeProps> | null = null;

export function VisualPrivacyBoundary(props: ViewProps) {
  const policy = React.useContext(VisualPrivacyContext);
  const live = React.useRef<object | null>(null);
  const focus = React.useRef<PrivacyFocusEvent | null>(null);
  const [released, setReleased] = React.useState(-1);
  React.useEffect(() => {
    const instance = {}; live.current = instance;
    return () => { live.current = null; focus.current = null; };
  }, []);
  if (policy === null) return <>{props.children}</>;
  if (Platform.OS !== 'android') return <View {...props} />;
  NativePrivacyView ??= require('./HttpPrivacyNativeView').default;
  const NativeBoundary = NativePrivacyView!;
  return <NativeBoundary {...props} collapsable={false}
    releasedGeneration={policy.covered ? -1 : released}
    onPrivacyFocus={event => {
      if (live.current === null) return;
      const next = event.nativeEvent; focus.current = next; setReleased(-1);
      if (!next.focused) return;
      const instance = live.current;
      void policy.validateReturn().then(() => {
        if (instance !== null && live.current === instance && focus.current === next) setReleased(next.generation);
      }).catch(() => { /* Obsolete/failed validation leaves this native boundary covered. */ });
    }} />;
}
