import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Simon Demo',
  description: 'Test the Simon ordering experience',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function DemoLayout({ children }: { children: ReactNode }) {
  // Use fixed positioning to break out of parent's max-w-md constraint
  return (
    <div className="fixed inset-0 bg-slate-100 overflow-hidden z-50">
      {children}
    </div>
  );
}
