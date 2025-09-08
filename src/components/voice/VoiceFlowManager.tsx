'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ShadcnSimonModal } from './ShadcnSimonModal';
import { useVoice } from '@/hooks/useVoice';
import { useTTS } from '@/hooks/useTTS';

export type SimonModalState = 'listening' | 'processing' | 'saying';

export type VoiceFlowState = 'idle' | 'listening' | 'processing' | 'streaming' | 'saying' | 'complete';

interface VoiceFlowManagerProps {
  onVoiceComplete: (text: string) => void;
  onError?: (error: Error) => void;
  isStreaming?: boolean;
}

export function useVoiceFlowManager({ 
  onVoiceComplete, 
  onError, 
  isStreaming = false
}: VoiceFlowManagerProps) {
  const [voiceFlowState, setVoiceFlowState] = useState<VoiceFlowState>('idle');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const lastUserMessageWasVoice = useRef<boolean>(false);

  // Voice hook for recording and STT
  const { startRecording, stopRecording, isRecording } = useVoice({
    onTranscriptionComplete: (text) => {
      setVoiceFlowState('processing');
      // Auto-submit the transcribed text
      onVoiceComplete(text);
      lastUserMessageWasVoice.current = true;
    },
    onError: (error) => {
      console.error('Voice error:', error);
      setVoiceFlowState('idle');
      setIsModalOpen(false);
      onError?.(error);
    },
    autoSubmit: true, // Enable auto-submit
  });

  // TTS hook for speech playback
  const { isPlaying, playText, stopPlayback } = useTTS({
    onPlaybackStart: () => {
      // Only transition to 'saying' state when TTS API successfully returns and starts playing
      setVoiceFlowState('saying');
    },
    onPlaybackComplete: () => {
      setVoiceFlowState('complete');
      lastUserMessageWasVoice.current = false;
      // Close modal after TTS completes
      setTimeout(() => {
        setIsModalOpen(false);
        setVoiceFlowState('idle');
      }, 1000);
    },
    onError: (error) => {
      console.error('TTS error:', error);
      setVoiceFlowState('complete');
      setIsModalOpen(false);
      onError?.(error);
    },
  });

  // Handle voice toggle
  const handleVoiceToggle = useCallback(() => {
    if (isRecording) {
      stopRecording();
      setVoiceFlowState('idle');
      setIsModalOpen(false);
    } else {
      setVoiceFlowState('listening');
      setIsModalOpen(true);
      startRecording();
    }
  }, [isRecording, startRecording, stopRecording]);

  // Handle stop listening
  const handleStopListening = useCallback(() => {
    stopRecording();
  }, [stopRecording]);

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setIsModalOpen(false);
    setVoiceFlowState('idle');
    if (isRecording) {
      stopRecording();
    }
    if (isPlaying) {
      stopPlayback();
    }
  }, [isRecording, isPlaying, stopRecording, stopPlayback]);

  // Update flow state based on external conditions
  const updateFlowState = useCallback(() => {
    if (voiceFlowState === 'processing' && isStreaming) {
      setVoiceFlowState('streaming');
    }
    // Note: 'saying' state is now handled by TTS onPlaybackStart callback
    // No longer automatically transition to 'saying' here
  }, [voiceFlowState, isStreaming]);

  // Effect to update flow state when streaming changes
  useEffect(() => {
    updateFlowState();
  }, [updateFlowState]);

  // Get modal state based on flow state
  const getModalState = (): SimonModalState => {
    switch (voiceFlowState) {
      case 'listening':
        return 'listening';
      case 'processing':
      case 'streaming':
        return 'processing';
      case 'saying':
        return 'saying';
      default:
        return 'listening';
    }
  };

  // Method to trigger TTS (called from Chatbot component)
  const triggerTTS = useCallback((text: string) => {
    // Stay in processing state until TTS API responds
    setVoiceFlowState('processing');
    playText(text);
  }, [playText]);

  return {
    // State
    voiceFlowState,
    isModalOpen,
    isRecording,
    isPlaying,
    lastUserMessageWasVoice: lastUserMessageWasVoice.current,
    
    // Actions
    handleVoiceToggle,
    handleStopListening,
    handleModalClose,
    triggerTTS,
    stopPlayback,
    
    // Modal
    modal: (
      <ShadcnSimonModal
        isOpen={isModalOpen}
        state={getModalState()}
        onClose={handleModalClose}
        onStopListening={handleStopListening}
      />
    )
  };
}
