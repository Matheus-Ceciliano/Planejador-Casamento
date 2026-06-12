import { useCallback, useRef, useState } from 'react';

type AsyncActionOptions<T> = {
  onSuccess?: (result: T) => void | Promise<void>;
  onError?: (error: unknown) => void | Promise<void>;
};

export function useAsyncAction<T = void>(options: AsyncActionOptions<T> = {}) {
  const runningRef = useRef(false);
  const [loading, setLoading] = useState(false);

  const run = useCallback(async (action: () => Promise<T>) => {
    if (runningRef.current) return undefined;

    runningRef.current = true;
    setLoading(true);

    try {
      const result = await action();
      await options.onSuccess?.(result);
      return result;
    } catch (error) {
      await options.onError?.(error);
      throw error;
    } finally {
      runningRef.current = false;
      setLoading(false);
    }
  }, [options]);

  return { run, loading };
}
