import type { Metadata } from "next";
import "@/style/new-globals.css";

export const metadata: Metadata = {
    title: "BisLli",
    description: "Bis-Helpi",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>)
{
    return (
        <html lang="he" dir="rtl">
            <body
                className='antialiased w-screen h-screen overflow-hidden' dir="rtl"
            >
                { children }
            </body>
        </html>
    );
}
