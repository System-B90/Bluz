"use client";

import SvgIcon from "@mui/material/SvgIcon";
import Image from "next/image";

import { getHiveBaseUrl } from "@/api-shared/common";

type HiveRuntimeLogoProps = {
    color?: undefined;
    generic?: false;
};
type HiveGenericLogoProps = {
    color?: string;
    generic?: true;
};

export type HiveLogoProps =
    {
        size?: number;
        className?: string;
    } & (HiveGenericLogoProps | HiveRuntimeLogoProps);

/**
 * Generic Hive logo component.
 * Fetches the SVG icon from the Hive server at runtime.
 */
function RuntimeHiveLogo({ size, className }: Omit<HiveLogoProps, "color" | "generic">)
{
    const url = `${getHiveBaseUrl()}/static/icon.svg`;

    return (
        <Image
            alt="Hive Logo"
            className={ className }
            height={ size }
            priority
            src={ url }
            style={ { flexShrink: 0 } }
            width={ size }
        />
    );
}

function GenericHiveLogo({ size, color, className }: Omit<HiveLogoProps, "generic">)
{
    return (
        <SvgIcon
            className={ className }
            sx={ { width: size, height: size, color } }
            viewBox="0 0 240 240"
        >
            <path
                d="M 148.967056 222 L 210.802826 53.229431 L 222.570404 60.019608 L 222.570404 179.510803 L 148.967056 222 Z M 85.152496 219.667374 L 15.589753 179.510803 L 15.589753 60.019608 L 24.732841 54.749954 L 85.152496 219.667374 Z M 117.497192 178.42749 L 68.990486 29.193939 L 119.079704 0.263672 L 166.482452 27.631714 L 117.497192 178.42749 Z"
                fill={ color }
                fillRule="evenodd"
                id="V"
                stroke="none"
            />
        </SvgIcon>
    );
}

export function HiveLogo({ generic = true, size = 16, color = "currentColor", className }: HiveLogoProps)
{
    const componentProps = { size, color, className };
    return generic ? <GenericHiveLogo { ...componentProps } /> : <RuntimeHiveLogo { ...componentProps } />;
}
