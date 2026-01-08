import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest
{
    return {
        name: 'Bluez',
        short_name: 'Bluez',
        description: 'לו"ז לכל בי"ס',
        start_url: '/',
        display: 'fullscreen',
        background_color: '#071624', // Updated to match your dark mode theme (Midnight Blue)
        theme_color: '#67C8DD',      // Your Primary Turquoise
        lang: 'he',
        dir: 'rtl',
        orientation: 'landscape',
        icons: [
            // Standard Favicon
            {
                src: '/favicon.ico',
                sizes: 'any',
                type: 'image/x-icon',
            },
            // Standard PWA Icon (Small)
            {
                src: '/Bluez_192x192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any maskable', // "maskable" allows Android to crop it safely into a circle/squircle
            },
            // Standard PWA Icon (Large)
            {
                src: '/Bluez_512x512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable',
            },
            // Main Vector Icon
            {
                src: '/Bluez.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'any',
            },
            // Android 13+ Themed Icon (The system colors this icon to match the user's wallpaper)
            {
                src: '/Bluez-Mask.svg',
                sizes: 'any',
                type: 'image/svg+xml',
                purpose: 'monochrome',
            },
            // Context-specific assets (Browsers may pick these up in specific contexts)
            {
                src: '/Bluez-LightBG.svg',
                sizes: 'any',
                type: 'image/svg+xml',
            },
            {
                src: '/Bluez-DarkBG.svg',
                sizes: 'any',
                type: 'image/svg+xml',
            },
        ],
    };
}