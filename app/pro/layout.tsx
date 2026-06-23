import type { Viewport } from 'next';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#fafaf9',
};

export default function PortfolioLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="portfolio-public-root min-h-[100dvh] bg-[#fafaf9] text-stone-900 antialiased [-webkit-font-smoothing:antialiased]">
      {children}
    </div>
  );
}
