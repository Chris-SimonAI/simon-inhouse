"use client";

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface NotificationState {
  isVisible: boolean;
  amount?: number;
  message?: string;
}

interface NotificationContextType {
  notification: NotificationState;
  showNotification: (amount: number, message?: string) => void;
  hideNotification: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notification, setNotification] = useState<NotificationState>({
    isVisible: false,
  });

  const showNotification = (amount: number, message?: string) => {
    setNotification({
      isVisible: true,
      amount,
      message,
    });
  };

  const hideNotification = () => {
    setNotification({
      isVisible: false,
    });
  };

  return (
    <NotificationContext.Provider value={{ notification, showNotification, hideNotification }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}