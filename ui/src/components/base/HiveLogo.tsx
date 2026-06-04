"use client";

import Image from "next/image";

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
    return (
        <Image
            alt="Hive"
            className={className}
            height={size}
            src={`${getHiveBaseUrl()}/static/icon.svg`}
            width={size}
        />
    );
}
