'use client';

import { HomeContent } from '@/components/home-content.tsx';
import { Suspense } from 'react';

export default function Home() {
  return (
    <Suspense fallback={
      <div className="h-full w-full flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
