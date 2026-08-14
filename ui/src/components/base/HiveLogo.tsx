"use client";

import SvgIcon from "@mui/material/SvgIcon";
import { useEffect, useState } from "react";

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
 *
 * Uses a plain <img>, not next/image: the Hive host is only known at
 * runtime, so it can't be whitelisted in next.config's images.remotePatterns
 * — next/image throws on an unlisted host instead of loading and letting
 * onError fall back.
 *
 * The server-rendered <img> starts loading before React hydrates, so a fast
 * failure (e.g. a 503) fires and finishes before hydration attaches the
 * onError listener to that same DOM node — the event is missed entirely,
 * and the browser never refires it. A second probe in an effect sidesteps
 * that race: it starts fresh after mount, independent of the <img>'s own
 * (already-lost) load lifecycle. onError stays as a fallback for a failure
 * that happens after mount instead.
 *
 * The probe is an Image, not a fetch: Hive serves /static/ without any
 * Access-Control-Allow-Origin, so a cross-origin fetch is rejected by the
 * browser whether or not the icon exists — which would fall back to the
 * generic logo on every deploy. Image loads are not subject to CORS.
 */
function RuntimeHiveLogo({ size, className }: Omit<HiveLogoProps, "color" | "generic">)
{
    const [ failed, setFailed ] = useState(false);
    const url = `${getHiveBaseUrl()}/static/icon.svg`;

    useEffect(() =>
    {
        let cancelled = false;

        const probe = new Image();
        probe.onerror = () =>
        {
            if (!cancelled)
            {
                setFailed(true);
            }
        };
        probe.src = url;

        return () => { cancelled = true; };
    }, [ url ]);

    if (failed)
    {
        return <GenericHiveLogo className={ className } size={ size } />;
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            alt="Hive Logo"
            className={ className }
            height={ size }
            onError={ () => setFailed(true) }
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
