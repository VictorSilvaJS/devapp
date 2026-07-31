import { useCallback, useRef } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Keyboard,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  View,
} from 'react-native';
import {
  FormErrors,
  getFirstFormErrorKey,
  getFormErrorScrollTarget,
} from '../utils/formValidationCompat';

type FocusableNode = { focus?: () => void };

export const useFormValidationFocus = <FieldName extends string>(
  visualOrder: readonly FieldName[],
) => {
  const scrollViewRef = useRef<ScrollView>(null);
  const currentOffsetRef = useRef(0);
  const fieldRefs = useRef<Partial<Record<FieldName, View | null>>>({});
  const focusRefs = useRef<Partial<Record<FieldName, FocusableNode | null>>>({});

  const registerField = useCallback(
    (fieldName: FieldName) => (node: View | null) => {
      fieldRefs.current[fieldName] = node;
    },
    [],
  );

  const registerFocusable = useCallback(
    (fieldName: FieldName) => (node: FocusableNode | null) => {
      focusRefs.current[fieldName] = node;
    },
    [],
  );

  const onScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    currentOffsetRef.current = event.nativeEvent.contentOffset.y;
  }, []);

  const focusFirstError = useCallback((errors: FormErrors): FieldName | null => {
    const firstField = getFirstFormErrorKey(errors, visualOrder) as FieldName | null;
    if (!firstField) return null;

    requestAnimationFrame(() => {
      const fieldNode = fieldRefs.current[firstField];
      const scrollNode = scrollViewRef.current;
      const focusNode = focusRefs.current[firstField];
      const message = errors[firstField];

      const transferFocus = () => {
        if (typeof focusNode?.focus === 'function') focusNode.focus();
        else Keyboard.dismiss();

        const nativeHandle = findNodeHandle((focusNode as any) || fieldNode);
        if (nativeHandle) AccessibilityInfo.setAccessibilityFocus(nativeHandle);
        if (typeof message === 'string' && message.trim()) {
          AccessibilityInfo.announceForAccessibility(message.trim());
        }
      };

      if (!fieldNode || !scrollNode) {
        transferFocus();
        return;
      }

      fieldNode.measure((_x, _y, _width, _height, _pageX, fieldPageY) => {
        (scrollNode as any).measure(
          (_sx: number, _sy: number, _sw: number, _sh: number, _spx: number, containerPageY: number) => {
            scrollNode.scrollTo({
              y: getFormErrorScrollTarget({
                currentOffset: currentOffsetRef.current,
                fieldPageY,
                containerPageY,
                topInset: 16,
              }),
              animated: true,
            });
            setTimeout(transferFocus, 320);
          },
        );
      });
    });

    return firstField;
  }, [visualOrder]);

  return { scrollViewRef, registerField, registerFocusable, onScroll, focusFirstError };
};
