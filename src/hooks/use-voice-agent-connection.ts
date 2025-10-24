'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { RealtimeAgent, RealtimeSession } from '@openai/agents-realtime';
import { generateVoiceAgentToken } from '@/actions/voice-agent';
import { createVoiceAgent, VOICE_AGENT_CONFIG } from '@/lib/voice';

export type VoiceStatus = 'listening' | 'speaking' | 'processing';

interface UseVoiceAgentConnectionProps {
  hotelContext: string;
  onError: (error: Error) => void;
  onConnectionChange: (connected: boolean) => void;
  onHandoffToLangGraph: (transcribedText: string) => void;
  onClose: () => void;
}


export function useVoiceAgentConnection({
  hotelContext,
  onError,
  onConnectionChange,
  onHandoffToLangGraph,
  onClose
}: UseVoiceAgentConnectionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<VoiceStatus>('listening');

  const sessionRef = useRef<RealtimeSession | null>(null);
  const agentRef = useRef<RealtimeAgent | null>(null);
  const lastUserInputRef = useRef<string>('');
  const handoffProcessedRef = useRef<boolean>(false);
  const pendingHandoffRef = useRef<{ userQuestion: string } | null>(null);
  const isDisconnectingRef = useRef<boolean>(false);
  const isConnectedRef = useRef<boolean>(false);
  const shouldCancelConnectionRef = useRef<boolean>(false);

  useEffect(() => {
    isConnectedRef.current = isConnected;
  }, [isConnected]);

  // Create agent with hotel context
  const createAgent = useCallback(() => {
    return createVoiceAgent(hotelContext);
  }, [hotelContext]);

  // Cancel connection if in progress
  const cancelConnection = useCallback(() => {
    shouldCancelConnectionRef.current = true;
  }, []);

  // Disconnect from voice agent
  const disconnect = useCallback(async () => {
    if (isDisconnectingRef.current) {
      return;
    }
    
    isDisconnectingRef.current = true;
    
    try {
      if (sessionRef.current) {
        try {
          if (isConnectedRef.current) {
            try {
              sessionRef.current.interrupt();
            } catch (interruptErr) {
              // Silently ignore expected WebRTC errors during handoff
              const errorMessage = interruptErr instanceof Error ? interruptErr.message : String(interruptErr);
              if (!errorMessage.includes('WebRTC data channel is not connected') && 
                  !errorMessage.includes('InvalidStateError')) {
                console.error('Session interrupt failed:', errorMessage);
              }
            }
          }
          
          sessionRef.current.close();
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err) {
          console.error('Error closing session:', err);
        }
        sessionRef.current = null;
      }

      if (agentRef.current) {
        agentRef.current = null;
      }

      // Reset handoff flags
      handoffProcessedRef.current = false;
      pendingHandoffRef.current = null;

      setIsConnected(false);
      setStatus('listening');
      onConnectionChange(false);
    } catch (err) {
      console.error('Error during disconnect cleanup:', err);
      handoffProcessedRef.current = false;
      pendingHandoffRef.current = null;

      setIsConnected(false);
      setStatus('listening');
      onConnectionChange(false);
    } finally {
      isDisconnectingRef.current = false;
    }
  }, [onConnectionChange]);

  // Helper function to process handoff
  const processHandoff = useCallback(async (userQuestion: string) => {    
    if (handoffProcessedRef.current) {
      return;
    }

    handoffProcessedRef.current = true;

    try {
      onHandoffToLangGraph(userQuestion);
    } catch (error) {
      console.error('Error calling onHandoffToLangGraph:', error);
    }

    pendingHandoffRef.current = null;

    try {
      await disconnect();
    } catch (error) {
      console.error('Error during handoff disconnect:', error);
    }
    
    onClose();
  }, [onHandoffToLangGraph, onClose, disconnect]);

  // Set up event listeners
  const setupEventListeners = useCallback((session: RealtimeSession) => {


    const handleResponseCompleted = async () => {
      // Check if we have a pending handoff to process
      if (pendingHandoffRef.current && !handoffProcessedRef.current) {
        const userQuestion = pendingHandoffRef.current.userQuestion;
        await processHandoff(userQuestion);
      }
    };


    const handleError = (error: { message?: string }) => {
      setError(error.message || 'Session error');
      onError(new Error(error.message || 'Session error'));
    };
    
    // Handle audio interruption from session events
    session.on('audio_interrupted', () => {
      setStatus('listening');
    });
    
    session.on('error', (error) => {
      // Convert RealtimeSessionError to expected format
      const errorMessage = error.error instanceof Error ? error.error.message : String(error.error);
      handleError({ message: errorMessage });
    });

    // Listen to transport events for better state management and transcript detection
    session.on('transport_event', (event) => {
      // Handle audio buffer events for proper speaking state
      if (event.type === 'output_audio_buffer.started') {
        setStatus('speaking');
      }
      
      if (event.type === 'output_audio_buffer.stopped') {
        setStatus('listening');
        // This is where we should check for handoff, not on audio_stopped
        handleResponseCompleted();
      }
      
      // Handle audio interruption when user cuts off Simon
      if (event.type === 'output_audio_buffer.cleared') {
        setStatus('listening');
      }
      
      // Also handle the official audio_interrupted event
      if (event.type === 'audio_interrupted') {
        setStatus('listening');
      }
      
      // Handle transcript deltas - keep listening state while guest is speaking
      if (event.type === 'conversation.item.input_audio_transcription.delta') {
        // Keep listening state while guest is speaking
        // Store the transcript delta
        if (event.delta) {
          lastUserInputRef.current = (lastUserInputRef.current || '') + event.delta;
        }
      }
      
      if (event.type === 'conversation.item.input_audio_transcription.completed') {
        // Keep listening state while guest is speaking
        if (event.transcript) {
          lastUserInputRef.current = event.transcript;
        }
      }
    });

    // Handle history updates for transcript detection and handoff processing
    session.on('history_updated', (history) => {
      if (history && history.length > 0) {
        const lastMessage = history[history.length - 1];
        
        // Check for user transcript (input)
        if (lastMessage && lastMessage.type === 'message') {
          // Keep listening state while processing user input
          // Store the user input for potential handoff
          if ('transcript' in lastMessage && lastMessage.transcript && typeof lastMessage.transcript === 'string') {
            lastUserInputRef.current = lastMessage.transcript;
          }
        }

        // Check if the last message is a completed handoff function call
        if (lastMessage && 
            lastMessage.type === 'function_call' && 
            lastMessage.name === 'handoff_to_visual' &&
            lastMessage.status === 'completed') {          
          // Prevent duplicate handoff processing
          if (handoffProcessedRef.current || pendingHandoffRef.current) {
            return;
          }

          // Extract user question from the function call arguments
          let userQuestion = lastUserInputRef.current;
          
          try {
            const toolArgs = JSON.parse(lastMessage.arguments || '{}');
            if (toolArgs.userQuestion) {
              userQuestion = toolArgs.userQuestion;
            }
          } catch (e) {
            console.warn('Failed to parse tool arguments:', e);
          }

          if (userQuestion) {
            // Store handoff for processing after audio completes (not immediately)
            pendingHandoffRef.current = { userQuestion };
          }
        }
      }
    });

  }, [processHandoff, onError]);

  // Connect to voice agent
  const connect = useCallback(async () => {
    if (isConnected || isConnecting) {
      return;
    }

    shouldCancelConnectionRef.current = false;
    handoffProcessedRef.current = false;
    pendingHandoffRef.current = null;

    try {
      setIsConnecting(true);
      setError(null);

      // Check for cancellation before token generation
      if (shouldCancelConnectionRef.current) {
        setIsConnecting(false);
        return;
      }

      // Generate ephemeral token
      const tokenResult = await generateVoiceAgentToken();
      if (!tokenResult.ok) {
        throw new Error(tokenResult.message);
      }
      const { clientSecret } = tokenResult.data;

      // Check for cancellation before creating session
      if (shouldCancelConnectionRef.current) {
        setIsConnecting(false);
        return;
      }

      // Create agent and session
      const agent = createAgent();
      const session = new RealtimeSession(agent, {
        model: VOICE_AGENT_CONFIG.model,
      });

      agentRef.current = agent;
      sessionRef.current = session;

      // Check for cancellation before setting up listeners
      if (shouldCancelConnectionRef.current) {
        setIsConnecting(false);
        return;
      }

      // Set up event listeners
      setupEventListeners(session);

      // Check for cancellation before connecting
      if (shouldCancelConnectionRef.current) {
        setIsConnecting(false);
        return;
      }

      // Connect to the session
      await session.connect({ apiKey: clientSecret });

      // Final check for cancellation before setting connected state
      if (shouldCancelConnectionRef.current) {
        setIsConnecting(false);
        return;
      }

      setIsConnected(true);
      setIsConnecting(false);
      setStatus('listening');
      onConnectionChange(true);

    } catch (err) {
      console.error('Voice agent connection error:', err);
      setIsConnecting(false);
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect to voice agent';
      setError(errorMessage);
      onError(new Error(errorMessage));
    }
  }, [isConnected, isConnecting, createAgent, onConnectionChange, onError, setupEventListeners]);

  // Cleanup on unmount
  useEffect(() => {
    // Only run on client side
    if (typeof window === 'undefined') return;
    
    return () => {      
      handoffProcessedRef.current = false;
      pendingHandoffRef.current = null;
      lastUserInputRef.current = '';
      isDisconnectingRef.current = false;      
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    error,
    status,
    connect,
    disconnect,
    cancelConnection,
    lastUserInput: lastUserInputRef.current
  };
}
