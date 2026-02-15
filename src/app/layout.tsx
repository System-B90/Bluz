import type { Metadata } from "next";
import "@/style/globals.css";

export const metadata: Metadata = {
    title: "Bluez",
    description: "Bis Luz",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    return (
        <html lang="he" dir="rtl" suppressHydrationWarning>
            <body
                className='antialiased w-screen h-screen overflow-hidden' dir="rtl"
            >
                { children }
            </body>
        </html>
    );
}
