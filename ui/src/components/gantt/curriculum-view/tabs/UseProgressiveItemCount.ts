import { useEffect, useRef, useState } from "react";

type ProgressiveItemCountOptions = {
  batchSize?: number;
  enabled?: boolean;
  initialCount?: number;
  resetKey?: string | number;
};

type IdleWindow = Window &
  typeof globalThis & {
    cancelIdleCallback?: (handle: number) => void;
    requestIdleCallback?: (
      callback: () => void,
      options?: { timeout: number },
    ) => number;
  };

function scheduleProgressiveRender(callback: () => void) {
    if (typeof window === "undefined") {
        return () => {};
    }

    const idleWindow = window as IdleWindow;

    if (idleWindow.requestIdleCallback) {
        const handle = idleWindow.requestIdleCallback(callback, { timeout: 120 });

        return () => idleWindow.cancelIdleCallback?.(handle);
    }

    const handle = window.setTimeout(callback, 16);

    return () => window.clearTimeout(handle);
}

export function useProgressiveItemCount(
    totalCount: number,
    {
        batchSize = 4,
        enabled = true,
        initialCount = 0,
        resetKey,
    }: ProgressiveItemCountOptions = {},
) {
    const previousResetKey = useRef(resetKey);
    const [visibleCount, setVisibleCount] = useState(() =>
        enabled ? Math.min(initialCount, totalCount) : 0,
    );

    useEffect(() => {
        const resetKeyChanged = previousResetKey.current !== resetKey;

        if (resetKeyChanged) {
            previousResetKey.current = resetKey;
        }

        setVisibleCount((currentVisibleCount) => {
            const nextInitialCount = enabled
                ? Math.min(initialCount, totalCount)
                : 0;

            if (resetKeyChanged) {
                return nextInitialCount;
            }

            if (!enabled) {
                return 0;
            }

            if (currentVisibleCount > totalCount) {
                return totalCount;
            }

            return Math.max(currentVisibleCount, nextInitialCount);
        });
    }, [enabled, initialCount, resetKey, totalCount]);

    useEffect(() => {
        if (!enabled || visibleCount >= totalCount) {
            return;
        }

        return scheduleProgressiveRender(() => {
            setVisibleCount((currentVisibleCount) =>
                Math.min(totalCount, currentVisibleCount + batchSize),
            );
        });
    }, [batchSize, enabled, totalCount, visibleCount]);

    return visibleCount;
}
