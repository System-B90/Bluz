import assert from "assert";

import type { Metadata } from "next";

import { MuiEmotionCacheProvider } from "@/components/theme/MuiEmotionCacheProvider";
import { BluzThemeProvider } from "@/components/theme/ThemeProvider";
import { WebSocketConfigProvider } from "@/components/WebsocketConfigProvider";
import { WEBSOCKET_PORT_SUFFIX, WEBSOCKET_PROTOCOL } from "@/settings";

export const metadata: Metadata = {
    title: "בלוז",
    description: 'בי"ס לכל לו"ז',
};

assert(process.env.NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_HOST || process.env.NODE_ENV === 'development', "NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_HOST environment variable must be set in production!");

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    // Sourced from a NEXT_PUBLIC_ var (like NEXT_PUBLIC_HIVE_URL) since this
    // value is handed straight to the browser to open the WS connection.
    const wsHost =
        process.env.NEXT_PUBLIC_WEBSOCKET_SESSION_SERVER_HOST || "bluz.dev";
    const wsProtocol = WEBSOCKET_PROTOCOL || "wss";
    const wsPortSuffix = WEBSOCKET_PORT_SUFFIX || "";

    return (
        <html dir="rtl" lang="he" suppressHydrationWarning>
            <body
                className="antialiased w-screen h-screen overflow-hidden"
                dir="rtl"
            >
                <MuiEmotionCacheProvider>
                    <BluzThemeProvider>
                        <WebSocketConfigProvider
                            host={ wsHost }
                            portSuffix={ wsPortSuffix }
                            protocol={ wsProtocol }
                        >
                            { children }
                        </WebSocketConfigProvider>
                    </BluzThemeProvider>
                </MuiEmotionCacheProvider>
            </body>
        </html>
    );
}
