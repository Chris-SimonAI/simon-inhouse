'use client';

import { SessionProvider } from '@/contexts/session-context';
import { QRCodeHandler } from '@/components/qr-code-handler';
import { SessionLoader } from '@/components/session-loader';
import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

interface AppWrapperProps {
  children: React.ReactNode;
}

export function AppWrapper({ children }: AppWrapperProps) {
  const pathname = usePathname();

  // Don't wrap API routes or specific paths that don't need the frame
  if (pathname.startsWith('/api/') || pathname.startsWith('/hotel/')) {
    return <>{children}</>;
  }

  return (
    <SessionProvider>
      <div className="h-dvh w-full bg-gray-50">
        <Suspense fallback={<div />}>
          <QRCodeHandler />
          <SessionLoader />
        </Suspense>
        <div className="h-dvh w-full flex justify-center">
          <div className="h-dvh w-full max-w-md">
            {children}
          </div>
        </div>
      </div>
    </SessionProvider>
  );
}
