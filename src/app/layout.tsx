import type { Metadata, Viewport } from 'next';
import '@/styles/globals.css';
import BottomNav from '@/components/BottomNav';

export const metadata: Metadata = {
  title: 'AI 과제 모니터',
  description: '나라장터, NTIS, 병원 AI 관련 과제 모니터링',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0f172a',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        <div className="max-w-lg mx-auto min-h-screen pb-20">
          {children}
        </div>
        <BottomNav />
      </body>
    </html>
  );
}
