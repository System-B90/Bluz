import type { Metadata } from "next";

import { MuiEmotionCacheProvider } from "@/components/theme/MuiEmotionCacheProvider";
import { BluzThemeProvider } from "@/components/theme/ThemeProvider";
import { WebSocketConfigProvider } from "@/components/WebsocketConfigProvider";
import {
    WEBSOCKET_PORT_SUFFIX,
    WEBSOCKET_PROTOCOL,
    WEBSOCKET_SESSION_SERVER_HOST,
} from "@/settings";

export const metadata: Metadata = {
    title: "בלוז",
    description: 'בי"ס לכל לו"ז',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    // Resolved server-side from WEBSOCKET_SESSION_SERVER_HOST at container
    // start (see @system-b90/session-ws), then handed to the browser to open
    // the WS connection.
    const wsHost = WEBSOCKET_SESSION_SERVER_HOST;
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
