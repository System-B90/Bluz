import type { Metadata } from "next";

import { MuiEmotionCacheProvider } from "@/components/theme/MuiEmotionCacheProvider";
import { WebSocketConfigProvider } from "@/components/WebsocketConfigProvider";
import { WEBSOCKET_PORT_SUFFIX, WEBSOCKET_PROTOCOL } from "@/settings";

import "@/style/globals.css";

export const metadata: Metadata = {
  title: "Bluz",
  description: "Bis Luz",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const wsHost = process.env.WEBSOCKET_SESSION_SERVER_HOST || "bluz.bis";
  const wsProtcol = WEBSOCKET_PROTOCOL || "wss";
  const wsPortSuffix = WEBSOCKET_PORT_SUFFIX || "";

  return (
    <html dir="rtl" lang="he" suppressHydrationWarning>
      <body className="antialiased w-screen h-screen overflow-hidden" dir="rtl">
        <WebSocketConfigProvider
          host={wsHost}
          portSuffix={wsPortSuffix}
          protocol={wsProtcol}
        >
          <MuiEmotionCacheProvider>{children}</MuiEmotionCacheProvider>
        </WebSocketConfigProvider>
      </body>
    </html>
  );
}
