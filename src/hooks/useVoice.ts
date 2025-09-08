'use client';

import { useCallback, useRef, useState } from 'react';
import { convertSpeechToText } from '@/actions/voice';

export type VoiceState = 'idle' | 'recording' | 'processing' | 'error';

export interface UseVoiceOptions {
  onTranscriptionComplete: (text: string) => void;
  onError?: (error: Error) => void;
  autoSubmit?: boolean;
}

export interface UseVoiceReturn {
  voiceState: VoiceState;
  startRecording: () => void;
  stopRecording: () => void;
  isRecording: boolean;
  error: string | null;
}

export function useVoice({
  onTranscriptionComplete,
  onError,
}: UseVoiceOptions): UseVoiceReturn {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [error, setError] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      setVoiceState('recording');
      
      // Get user media
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        } 
      });
      
      streamRef.current = stream;
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      // Handle data available
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // Handle recording stop
      mediaRecorder.onstop = async () => {
        try {
          setVoiceState('processing');
          
          // Create audio blob
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          
          // Convert to text
          const result = await convertSpeechToText(audioBlob);
          onTranscriptionComplete(result.text);
          
          setVoiceState('idle');
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Transcription failed';
          setError(errorMessage);
          setVoiceState('error');
          onError?.(err instanceof Error ? err : new Error(errorMessage));
        }
      };

      // Start recording
      mediaRecorder.start(100); // Collect data every 100ms
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      setVoiceState('error');
      onError?.(err instanceof Error ? err : new Error(errorMessage));
    }
  }, [onTranscriptionComplete, onError]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && voiceState === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
  }, [voiceState]);

  return {
    voiceState,
    startRecording,
    stopRecording,
    isRecording: voiceState === 'recording',
    error,
  };
}
