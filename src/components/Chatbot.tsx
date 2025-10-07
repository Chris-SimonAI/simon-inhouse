"use client";

import { useState, useEffect, ChangeEvent, FormEvent, useRef, useLayoutEffect } from "react";
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
import { RealtimeVoiceAgent, RealtimeVoiceAgentRef } from "@/components/voice/RealtimeVoiceAgent";
import VoiceIntroduction from "@/components/VoiceIntroduction";
import { Loader } from "@/components/ai-elements/loader";
import { Suggestion } from "@/components/suggestion";
import { PlaceCard } from "@/components/PlaceCard";
import { AmenityCard } from "@/components/AmenityCard";
import { AttractionsView } from "@/components/AttractionsView";
import { DineInRestaurantCard } from "@/components/DineInRestaurantCard";
import { type PlaceResult } from "@/lib/places";
import { type Amenity } from "@/db/schemas/amenities";
import { type Hotel } from "@/db/schemas/hotels";
import { cn } from "@/lib/utils";
import { type RscServerAction } from "@/actions/chatbot";
import type { UIMessage } from "ai";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { StickToBottomContext } from "use-stick-to-bottom";
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { SCROLL_STOP_TYPES, UI_TOOLS, UiTool, AssistantTextType } from "@/constants/uiTools";
import { ArrowLeft, Mic } from "lucide-react";
import { MarkdownResponse } from "./ai-elements/markdown-response";
import { AmenitiesLogo, AttractionsLogo, DiningLogo, HistoryLogo, InRoomDiningLogo } from "@/svgs";
import { DineInRestaurant } from "@/db";
import { CardSkeletonGroup } from "@/components/CardSkeleton";
import { AttractionsViewSkeleton } from "@/components/AttractionsViewSkeleton";

type Props = {
  processChatMessageStream: RscServerAction
  getThreadMessages: (threadId: string) => Promise<UIMessage[]>
  threadId: string
  hotel: Hotel
  hotelContext: string
};

const suggestions = [
  {
    icon: <InRoomDiningLogo className="w-7 h-7" />,
    label: "What options are available for dining in?",
    action: "I'd like to know about in-room dining options."
  },
  {
    icon: <DiningLogo className="w-7 h-7" />,
    label: "Recommended local dining",
    action: "Can you recommend some great local restaurants near the hotel?"
  },
  {
    icon: <AttractionsLogo className="w-7 h-7" />,
    label: "Nearby attractions",
    action: "Can you recommend nearby attractions and things to do in the area?"
  },
  {
    icon: <AmenitiesLogo className="w-7 h-7" />,
    label: "What hotel amenities do you offer?",
    action: "What hotel amenities do you offer?"
  },
  {
    icon: <HistoryLogo className="w-7 h-7" />,
    label: "Show chat history",
    action: null // Special case - just opens L1 without sending a message
  },
] as const;

export default function Chatbot({ processChatMessageStream, getThreadMessages, threadId, hotel, hotelContext }: Props) {
  const { messages, sendMessage, status, error } = useRscChat({
    action: processChatMessageStream,
    threadId: threadId,
    hotelId: hotel.id,
    getThreadMessages,
  });

  const searchParams = useSearchParams();
  const router = useRouter();
  const [openL1, setOpenL1] = useState(false);
  const [scrollToBottom, setScrollToBottom] = useState(false);
  const [input, setInput] = useState("");

  // Voice agent ref
  const voiceAgentRef = useRef<RealtimeVoiceAgentRef>(null);


  const [processedTippingMessages, setProcessedTippingMessages] = useState<Set<string>>(new Set());
  const [historicalMessageIds, setHistoricalMessageIds] = useState<Set<string>>(new Set());

  // Check for L1 parameter to open chat screen
  useEffect(() => {
    const l1Param = searchParams.get('l1');
    if (l1Param === 'open') {
      setOpenL1(true);
      // Clean up the URL parameter
      router.replace('/', { scroll: false });
    }
  }, [searchParams, router]);

  // Clean up tipping return URL parameter
  useEffect(() => {
    const tippingReturn = searchParams.get('tipping_return');
    if (tippingReturn === 'true') {
      // Clean up the URL parameter
      router.replace('/', { scroll: false });
    }
  }, [searchParams, router]);

  // Track historical messages to prevent tipping detection on chat history load
  useEffect(() => {
    if (messages.length > 0) {
      const _currentIds = new Set(messages.map(m => m.id));
      const newHistoricalIds = new Set([...historicalMessageIds]);
      
      // If we have messages but no historical IDs yet, these are loaded from history
      if (historicalMessageIds.size === 0 && messages.length > 0) {
        messages.forEach(m => newHistoricalIds.add(m.id));
        setHistoricalMessageIds(newHistoricalIds);
      }
    }
  }, [messages, historicalMessageIds]);

  // Handle sending text input (not voice-initiated)
  const handleTextSubmit = () => {
    if (input.trim()) {
      setOpenL1(true);
      setScrollToBottom(true);
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
    // Check if hotel context is available
    if (!hotelContext) {
      toast.error("Voice assistant temporarily unavailable", {
        description: "Please try again later.",
      });
      return;
    }
    
    voiceAgentRef.current?.openVoiceAgent(hotelContext);
  };

  const displayError = error ? (error.message || String(error)) : null;

  if (openL1) {
    return <ChatBotContent
        openL1={openL1}
        input={input}
        messages={messages}
        status={status}
          setOpenL1={setOpenL1}
        handleSubmit={handleSubmit}
        handleInputChange={handleInputChange}
        handleVoiceToggle={handleVoiceToggle}
        scrollToBottom={scrollToBottom}
        processedTippingMessages={processedTippingMessages}
        setProcessedTippingMessages={setProcessedTippingMessages}
      historicalMessageIds={historicalMessageIds}
      voiceAgentRef={voiceAgentRef}
      sendMessage={sendMessage}
      hotelContext={hotelContext}
    />
  }

  return <ChatBotContentHome
    openL1={openL1}
    input={input}
    messages={messages}
    setOpenL1={setOpenL1}
    handleSubmit={handleSubmit}
    handleVoiceToggle={handleVoiceToggle}
    displayError={displayError}
    sendMessage={sendMessage}
    setInput={setInput}
    setScrollToBottom={setScrollToBottom}
    hotel={hotel}
    voiceAgentRef={voiceAgentRef}
    hotelContext={hotelContext}
  />
}

type ChatBotContentProps = {
  openL1: boolean
  input: string
  messages: UIMessage[]
  status: 'streaming' | 'error' | 'submitted' | 'ready'
  setOpenL1: (open: boolean) => void
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void
  handleInputChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  handleVoiceToggle: () => void
  scrollToBottom: boolean
  processedTippingMessages: Set<string>
  setProcessedTippingMessages: (messages: Set<string> | ((prev: Set<string>) => Set<string>)) => void
  historicalMessageIds: Set<string>
  voiceAgentRef: React.RefObject<RealtimeVoiceAgentRef | null>
  sendMessage: (message: string, options: { inputType: 'text' | 'voice' }) => void
  hotelContext: string
}

function ChatBotContent({ openL1, input, messages, status, setOpenL1, handleSubmit, handleInputChange, handleVoiceToggle, scrollToBottom, processedTippingMessages, setProcessedTippingMessages, historicalMessageIds, voiceAgentRef, sendMessage, hotelContext }: ChatBotContentProps) {
  const conversationScrollContextRef = useRef<StickToBottomContext>(null);
  const latestMessage = messages[messages.length - 1];
  // we stop if the latest message is assistant, and the part of the message is in the SCROLL_STOP_TYPES
  const shouldStopScroll =
    latestMessage?.role === "assistant" &&
    SCROLL_STOP_TYPES.includes(
      latestMessage?.parts?.[latestMessage.parts.length - 1]?.type as UiTool | AssistantTextType
    );

  const { ref: attachScrollEl } = useScrollRestoration(
    "conversationScroll",
    { debounceTime: 200, persist: "localStorage" }
  );
  const pathname = usePathname();

  useEffect(() => {
    if (shouldStopScroll) {
      conversationScrollContextRef.current?.stopScroll?.();
    }
  }, [shouldStopScroll]);

  useLayoutEffect(() => {
    const ctx = conversationScrollContextRef.current;
    const el =
      ctx?.scrollRef?.current ??
      null;

    if (!el) return;

    attachScrollEl(el);

    if (scrollToBottom) {
        el.scrollTo({
          top: el.scrollHeight,
          behavior: "instant"
        });
    }

    return () => {
      attachScrollEl(null);
    };
  }, [attachScrollEl, conversationScrollContextRef, messages.length, scrollToBottom]);


  // this hook is to restore the scroll position when the user navigates back to the chatbot
  useLayoutEffect(() => {
    if (pathname !== "/") return;
    const el = conversationScrollContextRef.current?.scrollRef?.current;
    if (!el) return;

    const raw = localStorage.getItem("scrollRestoration-conversationScroll");
    if (!raw) return;

    const saved = JSON.parse(raw) as { scrollTop?: number; };

    if (!scrollToBottom) {
      el.scrollTop = saved.scrollTop ?? 0;
    }


  }, [pathname, conversationScrollContextRef, messages.length, scrollToBottom]);

  return (
    <div className={cn(
      openL1 ? "contents" : "hidden"
    )}>
      <RealtimeVoiceAgent
          ref={voiceAgentRef}
          onHandoffToLangGraph={(transcribedText) => {
            setOpenL1(true);
            sendMessage(transcribedText, { inputType: 'voice' });
          }}
        />
      <div className="flex flex-col h-dvh w-full overflow-x-hidden bg-white">
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

        <Conversation initial={false} resize={undefined} className="flex-1 overflow-y-auto" contextRef={conversationScrollContextRef}>
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
                      // AI agent will always render a message after a tool call
                      // but incase of UI_TOOLS.GET_DINE_IN_RESTAURANTS we don't want to render the message
                      if (i > 0 && message.parts[i - 1]?.type === UI_TOOLS.GET_DINE_IN_RESTAURANTS) {
                        return null;
                      }

                      // Handle loading states for tools
                      if (part.type === 'tool-search_attractions-loading') {
                        return (
                          <div key={`${message.id}-${i}`} className="py-2">
                            <AttractionsViewSkeleton />
                          </div>
                        );
                      }
                      
                      if (part.type === 'tool-search_restaurants-loading' || 
                          part.type === 'tool-get_amenities-loading' || 
                          part.type === 'tool-get_dine_in_restaurants-loading') {
                        return (
                          <div key={`${message.id}-${i}`} className="py-2">
                            <CardSkeletonGroup count={3} />
                          </div>
                        );
                      }

                      switch (part.type) {
                        case 'text':
                          return (
                            <MarkdownResponse key={`${message.id}-${i}`} className={cn(
                              message.role === 'assistant'
                                ? 'text-gray-700 leading-relaxed text-base'
                                : 'text-gray-700 text-base'
                            )} enableMarkdown={message.role === 'assistant' ? true : false}>
                              {part.text}
                            </MarkdownResponse>
                          );
                        case UI_TOOLS.EMIT_PREFACE:
                          return (
                            <Response key={`${message.id}-${i}`} className={cn(
                              message.role === 'assistant'
                                ? 'text-gray-700 leading-relaxed text-base'
                                : 'text-gray-700 text-base'
                            )}>
                              {part.output as string}
                            </Response>
                          );
                        case UI_TOOLS.SEARCH_RESTAURANTS:
                        case UI_TOOLS.SEARCH_ATTRACTIONS:
                          const results = JSON.parse(part.output as string).data as PlaceResult[] || [];

                          if (part.type === UI_TOOLS.SEARCH_ATTRACTIONS) {
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
                        case UI_TOOLS.GET_AMENITIES:
                          const parsedAmenity = JSON.parse(part.output as string);
                          const amenityResults = Array.isArray(parsedAmenity.data) ? parsedAmenity.data : [];
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
                        case UI_TOOLS.GET_DINE_IN_RESTAURANTS:
                          const parsed = JSON.parse(part.output as string);
                          const restaurantResults = Array.isArray(parsed.data) ? parsed.data : [];
                          
                          return (
                            <div key={`${message.id}-${i}`} className="space-y-2 py-2">
                              <h4 className="font-semibold">Deliver to your room</h4>
                              {restaurantResults.map((restaurant: DineInRestaurant) => (
                                <DineInRestaurantCard
                                  key={restaurant.restaurantGuid}
                                  {...restaurant}
                                />
                              ))}
                            </div>
                          );
                        case 'tool-initiate_tipping':
                          const tippingData = JSON.parse(part.output as string);
                          if (tippingData.action === 'navigate_to_tipping') {
                            // Only navigate if message hasn't been processed and it's not a historical message
                            const messageId = `${message.id}-${i}`;
                            const isHistoricalMessage = historicalMessageIds.has(message.id);
                            if (!processedTippingMessages.has(messageId) && !isHistoricalMessage) {
                              setProcessedTippingMessages(prev => new Set(prev).add(messageId));
                              setTimeout(() => {
                                // Add return parameter to track when user comes back
                                const url = new URL(tippingData.url, window.location.origin);
                                url.searchParams.set('return_to', window.location.pathname + window.location.search);
                                window.location.href = url.toString();
                              }, 100);
                            }
                          }
                          return null;
                        default:
                          return null;
                      }
                    })}

                    {/* Show "Generating..." below streaming text */}
                    {status === 'streaming' && message.role === 'assistant' && message.id === messages[messages.length - 1].id && (
                      <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
                        <Loader />
                        <span>Generating...</span>
                      </div>
                    )}

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
        <div className="px-4 pb-4 pt-4 mt-auto">
          <PromptInput onSubmit={handleSubmit} className="rounded-full border-0 relative">
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
                    "p-1 h-8 w-8 transition-colors text-gray-400 hover:text-gray-600",
                    !hotelContext && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Mic className="w-5 h-5" />
                </PromptInputButton>
              </PromptInputTools>
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}

type ChatBotContentHomeProps = {
  openL1: boolean
  input: string
  messages: UIMessage[]
  setOpenL1: (open: boolean) => void
  handleSubmit: (e: FormEvent<HTMLFormElement>) => void
  handleVoiceToggle: () => void
  displayError: string | null
  sendMessage: (message: string, options: { inputType: 'text' | 'voice' }) => void
  setInput: (input: string) => void
  setScrollToBottom: (scrollToBottom: boolean) => void
  hotel: Hotel
  voiceAgentRef: React.RefObject<RealtimeVoiceAgentRef | null>
  hotelContext: string
}

function ChatBotContentHome({ openL1, input, messages, setOpenL1, handleSubmit, handleVoiceToggle, displayError, sendMessage, setInput, setScrollToBottom, hotel, voiceAgentRef, hotelContext }: ChatBotContentHomeProps) {
  const introText = `Hi, I'm Simon—your 24/7 concierge at ${hotel.name}. I can help with hotel amenities, great places to eat, and things to do around the city. If you are hungry, I can also place food-delivery orders from a variety of our partner restaurants. ${hotel.name} encourages you to place food orders through me, so that I can coordinate with the front desk to ensure your meal comes straight to your room. How can I help today?`
  const displayText = "Hello. I am Simon, your personal AI concierge for the finest local recommendations, curated experiences, and exclusive hotel services while you enjoy your stay here."

  
  return (
    <div className={cn(
      openL1 ? "hidden" : "block"
    )}>
      <RealtimeVoiceAgent
        ref={voiceAgentRef}
        onHandoffToLangGraph={(transcribedText) => {
          setOpenL1(true);
          sendMessage(transcribedText, { inputType: 'voice' });
        }}
      />
      <div className="flex flex-col h-dvh w-full overflow-x-hidden bg-white">

        <div className="flex-1 overflow-y-auto px-4 text-center mb-2 mt-2">
          <h1 className="text-3xl font-light text-gray-800 mb-6">Simon</h1>

          <VoiceIntroduction
            introText={introText}
            sessionKey="simon-intro-played"
            autoPlayDelay={1000}
            showHelpMessage={true}
            className="mb-4"
            logoClassName="w-16 h-16"
          />

          <p className="text-gray-600 text-base leading-relaxed mb-8">
            {displayText}
          </p>

          <div className="px-2 mb-4">
            <h2 className="text-base leading-relaxed text-black-400 mb-2 text-left">How can I help you?</h2>
          </div>

          <div className="px-2 space-y-3 mb-6 flex flex-col w-full">
            {suggestions
              .filter((suggestion) =>
                suggestion.label !== "Show chat history" || messages.length > 0
              )
              .map((suggestion) => (
                <div key={suggestion.label} className="flex items-center gap-3">
                  <div className="text-gray-500 flex-shrink-0">
                    {suggestion.icon}
                  </div>
                  <Suggestion
                    onClick={() => {
                      setOpenL1(true);
                      setScrollToBottom(true);
                      if (suggestion.action) {
                        sendMessage(suggestion.action, { inputType: 'text' });
                      }
                    }}
                    suggestion={suggestion.label}
                    className={cn("p-4 bg-white rounded-2xl text-left text-gray-700 transition-colors justify-start hover:text-gray-700 hover:bg-gray-100",
                      suggestion.label === "Show chat history"
                        ? "border-0 shadow-none"
                        : ""
                    )}
                  >
                    <span className={cn("text-sm",
                      suggestion.label === "Show chat history"
                        ? "underline"
                        : ""
                    )}>
                      {suggestion.label}
                    </span>
                  </Suggestion>
                </div>
              ))}
          </div>

        </div>



        {displayError && (
          <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">Error: {displayError}</p>
          </div>
        )}


        <div className="px-4 pb-4 pt-4 mt-auto">
          <PromptInput onSubmit={handleSubmit} className="rounded-full border-0 relative">
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
                    "p-1 h-8 w-8 transition-colors text-gray-400 hover:text-gray-600",
                    !hotelContext && "opacity-50 cursor-not-allowed"
                  )}
                >
                  <Mic className="w-5 h-5" />
                </PromptInputButton>
              </PromptInputTools>
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    </div>
  )
}