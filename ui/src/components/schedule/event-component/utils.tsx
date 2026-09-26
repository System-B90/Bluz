import { useLayoutEffect, useRef, useState } from "react";

export type ContainerSize = {
    width: number;
    height: number;
};

export function useElementSize<T extends HTMLElement>() {
    const ref = useRef<null | T>(null);
    const [size, setSize] = useState<ContainerSize>({ width: 0, height: 0 });

    useLayoutEffect(() => {
        if (!ref.current) return;

        const observer = new ResizeObserver(([entry]) => {
            const { width, height } = entry.contentRect;
            setSize({ width, height });
        });

        observer.observe(ref.current);
        return () => observer.disconnect();
    }, []);

    return { ref, size };
}
