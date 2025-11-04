'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function QrCodePage() {
  const { code } = useParams();
  const router = useRouter();

  useEffect(() => {
    async function handleQrScan() {
      try {
        const response = await fetch(`/api/auth/qr-scan?qrCode=${code}`, {
          method: 'POST',
          credentials: 'include',
        });

        if (!response.ok) {
          router.replace('/session-not-found');
          return;
        }

        const result = await response.json();
        if (!result.ok) {
          router.replace('/session-not-found');
          return;
        }

        router.replace('/');
      } catch (error) {
        console.error('QR session error:', error);
        router.replace('/session-not-found');
      }
    }

    handleQrScan();
  }, [code, router]);

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="animate-spin h-8 w-8 border-b-2 border-blue-600 rounded-full" />
    </div>
  );
}
