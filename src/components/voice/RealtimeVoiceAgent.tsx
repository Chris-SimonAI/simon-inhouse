'use client';

import React, { useEffect, useCallback, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useVoiceAgentConnection } from '@/hooks/useVoiceAgentConnection';
import { VoiceAnimation } from './VoiceAnimation';
import { VoiceStatus } from './VoiceStatus';
import { getVoiceStatusText, getVoiceTapInstruction } from '@/lib/voice-utils';

interface RealtimeVoiceAgentProps {
  onHandoffToLangGraph: (transcribedText: string) => void;
}

export interface RealtimeVoiceAgentRef {
  openVoiceAgent: (context: string) => void;
  closeVoiceAgent: () => void;
  isModalOpen: boolean;
  isConnected: boolean;
  error: string | null;
  hotelContext: string;
}

export const RealtimeVoiceAgent = forwardRef<RealtimeVoiceAgentRef, RealtimeVoiceAgentProps>(({ 
  onHandoffToLangGraph
}, ref) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hotelContext, setHotelContext] = useState<string>('');
  
  // Store the last user input for handoff
  const lastUserInputRef = useRef<string>('');
  const isClosingRef = useRef<boolean>(false);

  // Voice agent control functions
  const openVoiceAgent = useCallback((context: string) => {
    setError(null);
    setHotelContext(context);
    setIsModalOpen(true);
  }, []);

  const closeVoiceAgent = useCallback(() => {
    setIsModalOpen(false);
    setIsConnected(false);
    setError(null);
  }, []);

  const handleHandoff = useCallback((transcribedText: string) => {
    // Store the transcribed text for handoff
    lastUserInputRef.current = transcribedText;
    
    // Close voice modal
    closeVoiceAgent();
    
    // Handoff to LangGraph
    onHandoffToLangGraph(transcribedText);
  }, [onHandoffToLangGraph, closeVoiceAgent]);

  const handleError = useCallback((error: Error) => {
    setError(error.message);
    
    // On error, fallback to L1 with text input
    closeVoiceAgent();
    onHandoffToLangGraph(lastUserInputRef.current || '');
  }, [closeVoiceAgent, onHandoffToLangGraph]);

  const handleConnectionChange = useCallback((connected: boolean) => {
    setIsConnected(connected);
  }, []);

  // Expose control functions to parent via ref
  useImperativeHandle(ref, () => ({
    openVoiceAgent,
    closeVoiceAgent,
    isModalOpen,
    isConnected,
    error,
    hotelContext
  }), [openVoiceAgent, closeVoiceAgent, isModalOpen, isConnected, error, hotelContext]);

  const {
    isConnected: _voiceConnected,
    isConnecting,
    error: connectionError,
    status,
    connect,
    disconnect,
    cancelConnection
  } = useVoiceAgentConnection({
    hotelContext,
    onError: handleError,
    onConnectionChange: handleConnectionChange,
    onHandoffToLangGraph: handleHandoff,
    onClose: closeVoiceAgent
  });

  const handleModalClose = useCallback(async () => {
    if (isClosingRef.current) {
      return;
    }
    
    isClosingRef.current = true;
    
    if (isConnecting) {
      cancelConnection();
    }
    
    try {
      await disconnect();
    } catch (error) {
      console.error('Error disconnecting voice agent:', error);
    }
    
    closeVoiceAgent();
    
    setTimeout(() => {
      isClosingRef.current = false;
    }, 500);
  }, [disconnect, closeVoiceAgent, isConnecting, cancelConnection]);

  useEffect(() => {
    if (isModalOpen && !isConnected && !isConnecting && !isClosingRef.current) {
      connect();
    }
  }, [isModalOpen, isConnected, isConnecting, connect]);

  useEffect(() => {
    return () => {
      disconnect();
      lastUserInputRef.current = '';
    };
  }, [disconnect]);



  return (
    <Dialog open={isModalOpen} onOpenChange={() => {
      // Do nothing when clicking outside - keep session running
    }}>
      <DialogContent 
        className="h-screen w-full max-w-md mx-auto bg-white p-0 border-0 rounded-none focus:outline-none"
        onClick={handleModalClose}
        showCloseButton={false}
      >
        <DialogTitle className="sr-only">
          Simon Voice Assistant - {getVoiceStatusText(status, isConnecting, isConnected)}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {getVoiceTapInstruction(status, isConnecting, isConnected)}
        </DialogDescription>

        <div className="flex flex-col h-screen w-full cursor-pointer hover:bg-gray-50 transition-colors">
          <div className="w-32 h-1 bg-gray-400 rounded-full mx-auto mt-2 mb-6"></div>

          <div className="px-6 text-center mb-2 flex-1 flex flex-col justify-center">
            <h1 className="text-3xl font-light text-gray-800 mb-6">Simon</h1>

            {/* Voice Animation */}
            <VoiceAnimation status={status} isConnecting={isConnecting} />

            {/* Status and Instructions */}
            <VoiceStatus 
              status={status} 
              isConnecting={isConnecting} 
              isConnected={isConnected} 
              error={error || connectionError} 
            />

          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
});

RealtimeVoiceAgent.displayName = 'RealtimeVoiceAgent';
