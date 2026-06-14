"use client";

import { getHiveBaseUrl } from "@/api-shared/common";

type HiveLogoProps = {
  size?: number;
  className?: string;
};

/**
 * Generic Hive logo component.
 * Fetches the SVG icon from the Hive server at runtime.
 */
export function HiveLogo({ size = 16, className }: HiveLogoProps) {
    const url = `${getHiveBaseUrl()}/static/icon.svg`;
    return (
        <span
            className={className}
            style={{
                width: size,
                height: size,
                display: "inline-block",
                backgroundColor: "currentColor",
                maskImage: `url(${url})`,
                maskRepeat: "no-repeat",
                maskPosition: "center",
                maskSize: "contain",
                WebkitMaskImage: `url(${url})`,
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
                WebkitMaskSize: "contain",
                flexShrink: 0,
            }}
        />
    );
}
