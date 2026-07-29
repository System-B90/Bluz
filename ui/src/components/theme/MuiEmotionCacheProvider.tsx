"use client";

import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
// eslint-disable-next-line no-restricted-imports -- RTL stylis plugin has no alternative import path
import rtlPlugin from "@mui/stylis-plugin-rtl";
// `stylis` is pinned to 4.2.0 (root package.json `overrides`) because this
// `prefixer` runs over AST nodes that @emotion/cache built with *its* bundled
// stylis. @emotion/cache@11 bundles 4.2.0; 4.3+ added `node.siblings` and its
// prefixer calls `lift()`, which does `append(root, root.siblings)` on nodes
// that don't have the field — `Cannot read properties of undefined (reading
// 'push')`, taking down the whole render. Only the two selector classes that
// hit prefixer's RULESET branch crashed (`::placeholder`, `:read-only` /
// `:read-write`), which is why it looked random. See #376.
import { prefixer } from "stylis";

export function MuiEmotionCacheProvider({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    return (
        <AppRouterCacheProvider
            options={ {
                key: "muirtl",
                enableCssLayer: true,
                stylisPlugins: [ prefixer, rtlPlugin ],
            } }
        >
            { children }
        </AppRouterCacheProvider>
    );
}
