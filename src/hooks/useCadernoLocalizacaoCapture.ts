import { useCallback, useEffect, useRef, useState } from 'react';
import {
  requestCurrentForegroundLocation,
} from '../services/LocationForegroundService';
import {
  buildCadernoLocalizacaoDraft,
  getCadernoLocalizacaoCaptureErrorMessage,
} from '../utils/cadernoLocalizacaoUiCompat';
import type { CadernoLocalizacaoExplicita } from '../utils/cadernoLocalizacaoCompat';

export type UseCadernoLocalizacaoCaptureOptions = {
  capturedBy?: string | null;
  onCaptured?: (location: CadernoLocalizacaoExplicita, contextId?: string) => void;
};

export type UseCadernoLocalizacaoCaptureResult = {
  loading: boolean;
  errorMessage: string;
  capture: (contextId?: string) => Promise<void>;
  isCapturePending: () => boolean;
  cancelPending: () => void;
  clearCaptureError: () => void;
};

const normalizeCapturedBy = (value?: string | null): string | undefined => {
  if (typeof value !== 'string') return undefined;
  const normalized = value.trim();
  return normalized || undefined;
};

export const useCadernoLocalizacaoCapture = ({
  capturedBy,
  onCaptured,
}: UseCadernoLocalizacaoCaptureOptions = {}): UseCadernoLocalizacaoCaptureResult => {
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);
  const requestIdRef = useRef(0);
  const capturedByRef = useRef(capturedBy);
  const onCapturedRef = useRef(onCaptured);

  capturedByRef.current = capturedBy;
  onCapturedRef.current = onCaptured;

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      inFlightRef.current = false;
      requestIdRef.current += 1;
    };
  }, []);

  const clearCaptureError = useCallback(() => {
    if (mountedRef.current) {
      setErrorMessage('');
    }
  }, []);

  const isCapturePending = useCallback(() => inFlightRef.current, []);

  const cancelPending = useCallback(() => {
    requestIdRef.current += 1;
    inFlightRef.current = false;

    if (mountedRef.current) {
      setLoading(false);
    }
  }, []);

  const capture = useCallback(async (
    contextId?: string
  ): Promise<void> => {
    if (inFlightRef.current || !mountedRef.current) {
      return;
    }

    inFlightRef.current = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const capturedByAtRequest = normalizeCapturedBy(capturedByRef.current);
    const contextIdAtRequest = contextId;
    setLoading(true);
    setErrorMessage('');

    try {
      const result = await requestCurrentForegroundLocation();
      const isCurrentRequest = mountedRef.current && requestIdRef.current === requestId;

      if (!isCurrentRequest) {
        return;
      }

      if (result.status !== 'ok') {
        setErrorMessage(getCadernoLocalizacaoCaptureErrorMessage(result.status));
        return;
      }

      const draft = buildCadernoLocalizacaoDraft(result.location, capturedByAtRequest);
      if (!draft) {
        setErrorMessage(getCadernoLocalizacaoCaptureErrorMessage('unavailable'));
        return;
      }

      onCapturedRef.current?.(draft, contextIdAtRequest);
    } catch {
      if (mountedRef.current && requestIdRef.current === requestId) {
        setErrorMessage(getCadernoLocalizacaoCaptureErrorMessage('error'));
      }
    } finally {
      if (mountedRef.current && requestIdRef.current === requestId) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  return {
    loading,
    errorMessage,
    capture,
    isCapturePending,
    cancelPending,
    clearCaptureError,
  };
};

export default useCadernoLocalizacaoCapture;
