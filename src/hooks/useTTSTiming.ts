'use client';

import { useCallback, useEffect, useRef } from 'react';

// Smart TTS text selection that handles all corner cases
function getSmartTTSText(text: string, isStreamComplete: boolean): string {
  const maxLength = 200;
  const minLength = 50;
  
  // If text is shorter than minLength, return as-is (for very short responses)
  if (text.length <= minLength) {
    return text.trim();
  }
  
  // If text is shorter than maxLength, return as-is
  if (text.length <= maxLength) {
    return text.trim();
  }
  
  // Take the first maxLength characters
  const candidate = text.substring(0, maxLength).trim();
  
  // If stream is complete, try to find a good ending point
  if (isStreamComplete) {
    // Look for sentence endings in order of preference
    const sentenceEndings = ['. ', '! ', '? '];
    
    for (const ending of sentenceEndings) {
      const lastIndex = candidate.lastIndexOf(ending);
      if (lastIndex > minLength) {
        return candidate.substring(0, lastIndex + 1).trim();
      }
    }
    
    // If no sentence endings found, look for other natural breaks
    const naturalBreaks = [', ', '; ', ' - ', ' — '];
    
    for (const breakPoint of naturalBreaks) {
      const lastIndex = candidate.lastIndexOf(breakPoint);
      if (lastIndex > minLength) {
        return candidate.substring(0, lastIndex).trim();
      }
    }
    
    // If still no good break point, look for word boundaries
    const lastSpace = candidate.lastIndexOf(' ');
    if (lastSpace > minLength) {
      return candidate.substring(0, lastSpace).trim();
    }
  }
  
  // For streaming (not complete), be more conservative
  // Look for sentence endings only
  const sentenceEndings = ['. ', '! ', '? '];
  
  for (const ending of sentenceEndings) {
    const lastIndex = candidate.lastIndexOf(ending);
    if (lastIndex > minLength) {
      return candidate.substring(0, lastIndex + 1).trim();
    }
  }
  
  // If no sentence endings found while streaming, return truncated text
  // This ensures we don't wait too long for a complete sentence
  return candidate;
}

interface UseTTSTimingProps {
  messages: Array<{
    id: string;
    role: 'user' | 'system' | 'assistant';
    parts: Array<{
      type: string;
      text?: string;
    }>;
  }>;
  voiceFlow: {
    lastUserMessageWasVoice: boolean;
    triggerTTS: (text: string) => void;
  };
  status: string;
}

export function useTTSTiming({ messages, voiceFlow, status }: UseTTSTimingProps) {
  const lastSpokenTextRef = useRef<string>("");
  const currentResponseIdRef = useRef<string | null>(null);
  const hasSpokenForCurrentResponse = useRef<boolean>(false);

  // TTS for streaming responses with smart timing
  useEffect(() => {
    if (messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.role === 'assistant' && lastMessage.parts.length > 0) {
        const textPart = lastMessage.parts.find(part => part.type === 'text');
        if (textPart && 'text' in textPart && textPart.text) {
          const currentText = textPart.text;
          
          // Check if this is a new response (different ID or no current ID)
          const isNewResponse = currentResponseIdRef.current !== lastMessage.id;
          
          if (isNewResponse) {
            currentResponseIdRef.current = lastMessage.id;
            lastSpokenTextRef.current = "";
            hasSpokenForCurrentResponse.current = false;
          }
          
          // Smart TTS timing: trigger when 100-150 chars are streamed OR stream ends
          if (voiceFlow.lastUserMessageWasVoice && 
              currentResponseIdRef.current === lastMessage.id && 
              !hasSpokenForCurrentResponse.current) {
            
            const shouldSpeak = 
              // Case 1: Stream ended (status is ready and we have text)
              (status === 'ready' && currentText.length > 0) ||
              // Case 2: We have 100+ characters and still streaming
              (status === 'submitted' && currentText.length >= 100);
            
            if (shouldSpeak) {
              // Smart text selection for TTS
              const textToSpeak = getSmartTTSText(currentText, status === 'ready');
              lastSpokenTextRef.current = textToSpeak;
              hasSpokenForCurrentResponse.current = true;
              voiceFlow.triggerTTS(textToSpeak);
            }
          }
        }
      }
    }
  }, [messages, voiceFlow, status]);

  const resetResponseTracking = useCallback(() => {
    currentResponseIdRef.current = null;
    lastSpokenTextRef.current = "";
    hasSpokenForCurrentResponse.current = false;
  }, []);

  return {
    lastSpokenTextRef,
    currentResponseIdRef,
    hasSpokenForCurrentResponse,
    resetResponseTracking
  };
}
