import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest
{
    return {
        name: 'Bluez',
        short_name: 'Bluez',
        description: 'לו"ז לכל בי"ס',
        start_url: '/',
        display: 'fullscreen',
        background_color: '#09090b',
        theme_color: '#67C8DD',
        lang: 'he',
        dir: 'rtl',
        icons: [
            {
                src: '/favicon.ico',
                sizes: 'any',
                type: 'image/x-icon',
            },
        ],
    };
}
