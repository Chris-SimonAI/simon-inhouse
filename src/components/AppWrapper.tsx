'use client';

import { SessionProvider } from '@/contexts/SessionContext';
import { QRCodeHandler } from '@/components/QRCodehandler';
import { SessionLoader } from '@/components/SessionLoader';
import { usePathname } from 'next/navigation';

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
        <QRCodeHandler />
        <SessionLoader />
        <div className="h-dvh w-full flex justify-center">
          <div className="h-dvh w-full max-w-md">
            {children}
          </div>
        </div>
      </div>
    </SessionProvider>
  );
}
