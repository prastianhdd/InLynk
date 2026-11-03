import type { Metadata, Viewport } from 'next';
import './globals.css';
import { ServiceWorker } from '@/components/ServiceWorker';

export const metadata: Metadata = { title: 'InLynk — Teman Bicara', description: 'Teman ngobrol dan belajar bahasa, lewat suara.', applicationName: 'InLynk', appleWebApp: { capable: true, title: 'InLynk', statusBarStyle: 'default' } };
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#f6f3ed' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}<ServiceWorker/></body></html>;
}
