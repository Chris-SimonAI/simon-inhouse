"use client";

import { useState, useEffect } from "react";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputButton,
  PromptInputTextarea,
  PromptInputToolbar,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import { Response } from "@/components/ai-elements/response";
import { useRscChat } from "@/hooks/useRscChat";
import { useVoiceFlowManager } from "@/components/voice/VoiceFlowManager";
import { useTTSTiming } from "@/hooks/useTTSTiming";
import { Loader } from "@/components/ai-elements/loader";
import { Home, Building2, MapPin, Utensils, Mic, ArrowLeft, MessageSquare, MicOff } from 'lucide-react'
import { Suggestion, Suggestions } from "./suggestion";
import { PlaceCard } from "./PlaceCard";
import { AmenityCard } from "./AmenityCard";
import { AttractionsView } from "./AttractionsView";
import { type PlaceResult } from "@/lib/places";
import { type Amenity } from "@/db/schemas/amenities";
import { cn } from "@/lib/utils";
import { type RscServerAction } from "@/actions/chatbot";
import type { UIMessage } from "ai";
import { useSearchParams, useRouter } from "next/navigation";

type Props = {
  processChatMessageStream: RscServerAction
  getThreadMessages: (threadId: string) => Promise<UIMessage[]>
  threadId: string
};

const suggestions = [
  {
    icon: <Home className="w-5 h-5" />,
    label: "What options are available for dining in?",
    action: "What options are available for dining in? I'd like to know about in-room dining and room service options."
  },
  {
    icon: <Utensils className="w-5 h-5" />,
    label: "Recommended local dining",
    action: "Can you recommend some great local restaurants near the hotel? I'm looking for good dining options in the area."
  },
  {
    icon: <MapPin className="w-5 h-5" />,
    label: "Nearby attractions",
    action: "Can you recommend nearby attractions and things to do in the area?"
  },
  {
    icon: <Building2 className="w-5 h-5" />,
    label: "What hotel amenities do you offer?",
    action: "What hotel amenities do you offer?"
  },
  {
    icon: <MessageSquare className="w-5 h-5" />,
    label: "Show chat history",
    action: null // Special case - just opens L1 without sending a message
  },
] as const;

export default function Chatbot({ processChatMessageStream, getThreadMessages, threadId }: Props) {
  const { messages, sendMessage, status, error } = useRscChat({
    action: processChatMessageStream,
    threadId: threadId,
    getThreadMessages,
  });

  const searchParams = useSearchParams();
  const router = useRouter();
  const [openL1, setOpenL1] = useState(false);
  const [input, setInput] = useState("");

  // Check for L1 parameter to open chat screen
  useEffect(() => {
    const l1Param = searchParams.get('l1');
    if (l1Param === 'open') {
      setOpenL1(true);
      // Clean up the URL parameter
      router.replace('/', { scroll: false });
    }
  }, [searchParams, router]);

  // Voice flow manager
  const voiceFlow = useVoiceFlowManager({
    onVoiceComplete: (text) => {
      setOpenL1(true);
      // Reset response tracking for new message
      ttsTiming.resetResponseTracking();
      
      sendMessage(text, { inputType: 'voice' } );
    },
    onError: (error) => {
      console.error('Voice flow error:', error);
    },
    isStreaming: status === 'submitted'
  });

  // TTS timing hook
  const ttsTiming = useTTSTiming({ messages, voiceFlow, status });

  // Handle sending text input (not voice-initiated)
  const handleTextSubmit = () => {
    if (input.trim()) {
      setOpenL1(true);
      // Reset response tracking for new message
      ttsTiming.resetResponseTracking();
      
      sendMessage(input, { inputType: 'text' });
      setInput("");
    }
  };


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleTextSubmit();
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
  };

  const handleVoiceToggle = () => {
    voiceFlow.handleVoiceToggle();
  };

  const displayError = error ? (error.message || String(error)) : null;

  if (openL1) {
    return (
      <>
        {voiceFlow.modal}
        <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-white relative">
        <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-white">
          <button
            onClick={() => setOpenL1(false)}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="text-sm font-medium text-gray-900">Simon</div>
          <div className="w-12"></div>
        </div>

        <Conversation className="flex-1">
          <ConversationContent>

            {messages.map((message) => (
              <Message from={message.role} key={message.id} className={cn(
                "flex gap-3",
                message.role === 'assistant' ? 'items-start' : 'justify-end py-0'
              )}>

                <div className={cn(
                  "flex flex-col",
                  message.role === 'assistant' ? 'items-start !min-w-full' : 'items-end !min-w-full'
                )}>

                  <MessageContent className={cn(
                    message.role === 'assistant'
                      ? '!bg-transparent rounded-2xl rounded-tl-md !min-w-full max-w-full p-0 py-1'
                      : '!bg-gray-200 !text-gray-700 rounded-full pl-6 pr-4 py-2 pl-6 shadow-sm !min-w-full text-right max-w-full [&>div]:flex [&>div]:items-center [&>div]:gap-2'
                  )}>
                    {/* only show */}
                    {status === 'submitted' && message.role === 'assistant' && message.id === messages[messages.length - 1].id && (
                      <Loader />
                    )}

                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case 'text':
                          return (
                            <Response key={`${message.id}-${i}`} className={cn(
                              message.role === 'assistant'
                                ? 'text-gray-700 leading-relaxed'
                                : 'text-gray-700'
                            )}>
                              {part.text}
                            </Response>
                          );
                        case 'tool-search_restaurants':
                        case 'tool-search_attractions':
                          const results = JSON.parse(part.output as string).data as PlaceResult[] || [];

                          if (part.type === 'tool-search_attractions') {
                            return (
                              <div key={`${message.id}-${i}`} className="py-2">
                                <AttractionsView
                                  attractions={results}
                                  messageId={message.id}
                                  partIndex={i}
                                />
                              </div>
                            );
                          } else {
                            return (
                              <div key={`${message.id}-${i}`} className="space-y-2 py-2">
                                {results.map((result: PlaceResult, index: number) => (
                                  <PlaceCard
                                    key={`${message.id}-${i}-${index}`}
                                    result={result}
                                    index={index}
                                    messageId={message.id}
                                    partIndex={i}
                                    type="restaurant"
                                    id={result.id}
                                  />
                                ))}
                              </div>
                            );
                          }
                        case 'tool-get_amenities':
                          const amenityResults = JSON.parse(part.output as string).data as Amenity[] || [];
                          return (
                            <div key={`${message.id}-${i}`} className="space-y-2 py-2">
                              {amenityResults.map((amenity: Amenity, index: number) => (
                                <AmenityCard
                                  key={`${message.id}-${i}-${index}`}
                                  amenity={amenity}
                                  index={index}
                                  messageId={message.id}
                                  partIndex={i}
                                />
                              ))}
                            </div>
                          );
                        default:
                          return null;
                      }
                    })}

                      {/* if not assistant, an S character in a white circle */}
                {message.role !== 'assistant' && (
                  <div className="w-6 h-6 border border-gray-700/50 bg-white rounded-full flex items-center justify-center">
                    <span className="text-gray-700 text-xs">S</span>
                  </div>
                )}
                  </MessageContent>

              
                </div>
              </Message>
            ))}

          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="px-6 pb-8 pt-4 mt-auto">
          <PromptInput onSubmit={handleSubmit} className="bg-gray-50 rounded-full border-0 relative">
            <PromptInputTextarea
              onChange={handleInputChange}
              value={input}
              placeholder="Ask Simon anything"
              className="bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 resize-none min-h-[50px] rounded-full pl-4 pr-16 pt-4"
            />
            <PromptInputToolbar className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <PromptInputTools>
                <PromptInputButton
                  variant="ghost"
                  onClick={handleVoiceToggle}
                  className={cn(
                    "p-1 h-8 w-8 transition-colors",
                    voiceFlow.isRecording 
                      ? "text-red-500 hover:text-red-600 animate-pulse" 
                      : "text-gray-400 hover:text-gray-600"
                  )}
                >
                  {voiceFlow.isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                </PromptInputButton>
              </PromptInputTools>
            </PromptInputToolbar>
          </PromptInput>
        </div>
        </div>
      </>
    )
  }

  return (
    <>
      {voiceFlow.modal}
      <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-white">
        <div className="w-32 h-1 bg-gray-400 rounded-full mx-auto mt-2 mb-6"></div>

        <div className="px-6 text-center mb-2">
          <h1 className="text-3xl font-light text-gray-800 mb-6">Simon</h1>

          <p className="text-gray-600 text-base leading-relaxed mb-8">
            Hello. I am Simon, your personal AI concierge for the finest local recommendations, curated experiences, and exclusive hotel services while you enjoy your stay here.
          </p>

          <h2 className="text-xl font-medium text-gray-800 mb-6">How can I help you?</h2>
        </div>



      <Suggestions className="px-6 space-y-3 mb-6 flex flex-col w-full">
        {suggestions
          .filter((suggestion) =>
            suggestion.label !== "Show chat history" || messages.length > 0
          )
          .map((suggestion) => (
            <Suggestion
              key={suggestion.label}
              onClick={() => {
                setOpenL1(true);
                if (suggestion.action) {
                  sendMessage(suggestion.action, { inputType: 'text' });
                }
              }}
              suggestion={suggestion.label}
              className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-2xl text-left text-gray-700 transition-colors justify-start hover:text-gray-700 hover:bg-gray-100"
            >
              <div className="text-gray-500">
                {suggestion.icon}
              </div>
              <span className="text-sm">{suggestion.label}</span>
            </Suggestion>
          ))}
      </Suggestions>

      {displayError && (
        <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">Error: {displayError}</p>
        </div>
      )}

      <div className="px-6 pb-8 pt-4 mt-auto">
        <PromptInput onSubmit={handleSubmit} className="bg-gray-50 rounded-full border-0 relative">
          <PromptInputTextarea
            onChange={(e) => setInput(e.target.value)}
            value={input}
            placeholder="Ask Simon anything"
            className="bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 resize-none min-h-[50px] rounded-full pl-4 pr-16 pt-4"
          />
          <PromptInputToolbar className="absolute right-4 top-1/2 transform -translate-y-1/2">
            <PromptInputTools>
              <PromptInputButton
                variant="ghost"
                onClick={handleVoiceToggle}
                className={cn(
                  "p-1 h-8 w-8 transition-colors",
                  voiceFlow.isRecording 
                    ? "text-red-500 hover:text-red-600 animate-pulse" 
                    : "text-gray-400 hover:text-gray-600"
                )}
              >
                {voiceFlow.isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </PromptInputButton>
            </PromptInputTools>
          </PromptInputToolbar>
        </PromptInput>
      </div>
      </div>
    </>
  );
}
