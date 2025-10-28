'use client';

import { createContext, useContext, useState, ReactNode } from 'react';
import { Hotel } from '@/db/schemas/hotels';

interface SessionData {
  threadId: string;
  hotel: Hotel;
  hotelContext: string;
  isLoaded: boolean;
}

interface SessionContextType {
  sessionData: SessionData | null;
  setSessionData: (data: SessionData | null) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  return (
    <SessionContext.Provider value={{ sessionData, setSessionData, isLoading, setIsLoading }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
