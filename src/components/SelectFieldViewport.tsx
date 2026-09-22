import React, { useEffect, useRef, useState } from 'react';
import { Keyboard, View, type KeyboardMetrics } from 'react-native';

type Frame = { y: number; height: number };

// Native measurements use layout units, never screenshot pixels.
// Intersect with the measured frame instead of subtracting a keyboard height:
// Android may already have resized that window.
export function selectViewportInset(frame: Frame | null, keyboard: KeyboardMetrics | undefined) {
  if (!frame || !keyboard || keyboard.height <= 0) return 0;
  return Math.max(0, Math.min(frame.height, frame.y + frame.height - keyboard.screenY));
}

export default function SelectFieldViewport({ children }: React.PropsWithChildren) {
  const viewport = useRef<View>(null);
  const generation = useRef(0);
  const [frame, setFrame] = useState<Frame | null>(null);
  const [keyboard, setKeyboard] = useState(() => Keyboard.metrics());
  useEffect(() => {
    // A selector may open while another field already owns the keyboard.
    const shown = Keyboard.addListener('keyboardDidShow', event => setKeyboard(event.endCoordinates));
    const changed = Keyboard.addListener('keyboardDidChangeFrame', event => setKeyboard(event.endCoordinates));
    const hidden = Keyboard.addListener('keyboardDidHide', () => setKeyboard(undefined));
    setKeyboard(Keyboard.metrics());
    return () => {
      generation.current += 1;
      shown.remove(); changed.remove(); hidden.remove();
    };
  }, []);
  return <View ref={viewport} collapsable={false} style={{ flex: 1 }} onLayout={() => {
    const current = ++generation.current;
    viewport.current?.measureInWindow((_x, y, _width, height) => {
      if (current === generation.current) setFrame({ y, height });
    });
  }}>
    <View style={{ flex: 1, paddingBottom: selectViewportInset(frame, keyboard) }}>{children}</View>
  </View>;
}
