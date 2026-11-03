import type { MetadataRoute } from 'next';
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/', name: 'InLynk — Teman Bicara', short_name: 'InLynk', description: 'Teman curhat dan belajar bahasa lewat suara.',
    lang: 'id', start_url: '/', scope: '/', display: 'standalone', background_color: '#f6f3ed', theme_color: '#f6f3ed',
    icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' }, { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' }, { src: '/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }]
  };
}
