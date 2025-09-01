"use client";

import { useState } from "react";
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
import { Loader } from "@/components/ai-elements/loader";
import { Home, Building2, MapPin, Utensils, Mic, ArrowLeft } from 'lucide-react'
import { Suggestion, Suggestions } from "./suggestion";
import { cn } from "@/lib/utils";

type ExtraData = {
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  data?: unknown;
};

type Props = {
  processChatMessageStream: (args: {
    message: string;
    threadId?: string;
    extra?: ExtraData;
  }) => Promise<{ stream: unknown }>
  threadId?: string
};

type RestaurantResult = {
  name: string;
  distanceKm: number;
  cuisine: string;
  priceRange: string;
  description: string;
  imageUrl?: string;
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
    label: "Can you recommend nearby attractions?",
    action: "Can you recommend nearby attractions and things to do around Los Angeles and Santa Monica?"
  },
  {
    icon: <Building2 className="w-5 h-5" />,
    label: "What hotel amenities do you offer?",
    action: "What hotel amenities do you offer?"
  },
] as const;

export default function Chatbot({ processChatMessageStream, threadId = Math.random().toString(36).substring(2, 15) }: Props) {
  const { messages, sendMessage, status, error } = useRscChat({
    action: processChatMessageStream,
    threadId: threadId,
  });

  const [openL1, setOpenL1] = useState(false);


  const [input, setInput] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      setOpenL1(true);
      sendMessage(input);
      setInput("");
    }
  };

  const errorMessage = error ? (error.message || String(error)) : null;

  if (openL1) {
    return (
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

        <Conversation className="flex-1 bg-gray-50">
          <ConversationContent>

            {messages.map((message) => (
              <Message from={message.role} key={message.id} className={cn(
                "flex gap-3",
                message.role === 'assistant' ? 'items-start' : 'justify-end'
              )}>

                <div className={cn(
                  "flex flex-col",
                  message.role === 'assistant' ? 'items-start !min-w-full' : 'items-end max-w-xs'
                )}>

                  <MessageContent className={cn(
                    message.role === 'assistant'
                      ? '!bg-white rounded-2xl rounded-tl-md p-4 shadow-sm !min-w-full'
                      : 'bg-orange-400 text-white rounded-2xl rounded-tr-md p-3 shadow-sm'
                  )}>
                    {message.role === 'assistant' && (
                      <span className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 bg-black rounded-full flex items-center justify-center flex-shrink-0">
                          <div className="text-white text-sm font-bold">∞</div>
                        </div>

                        <span className="text-sm font-medium text-gray-900 mb-1">Simon</span>
                      </span>
                    )}

                    {status === 'submitted' && message.role === 'assistant' && (
                      <Loader />
                    )}

                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case 'text':
                          return (
                            <Response key={`${message.id}-${i}`} className={cn(
                              "text-sm",
                              message.role === 'assistant'
                                ? 'text-gray-700 leading-relaxed'
                                : 'text-white'
                            )}>
                              {part.text}
                            </Response>
                          );
                        case 'tool-search_places':
                          const results = JSON.parse(part.output as string).results || [];
                          return (
                            <div key={`${message.id}-${i}`} className="space-y-4">
                              {results.map((result: RestaurantResult, index: number) => (
                                <div key={`${message.id}-${i}-${index}`} className="bg-white border rounded-lg p-4 shadow-sm">
                                  <h3 className="font-semibold text-lg text-gray-900 mb-1">
                                    {result.name}
                                  </h3>
                                  <p className="text-sm text-indigo-600 font-medium mb-2">
                                    {result.cuisine}
                                  </p>
                                  <p className="text-gray-600 text-sm mb-3">
                                    {result.description}
                                  </p>
                                  <div className="flex items-center justify-between text-sm text-gray-500">
                                    <span className="flex items-center">
                                      <MapPin className="w-4 h-4 mr-1" />
                                      {result.distanceKm}
                                    </span>
                                    <span className="font-medium text-gray-900">
                                      {result.priceRange}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        default:
                          return null;
                      }
                    })}
                  </MessageContent>

                  <span className={cn(
                    "text-xs text-gray-500 mt-2",
                    message.role === 'assistant' ? 'ml-1' : 'mr-1'
                  )}>
                    {new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </span>
                </div>
              </Message>
            ))}

          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="px-6 pb-8 pt-4 mt-auto">
          <PromptInput onSubmit={handleSubmit} className="bg-gray-50 rounded-full border-0 relative">
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
              placeholder="Ask Simon anything"
              className="bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 resize-none min-h-[50px] rounded-full pl-12 pr-16 pt-4"
            />
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-black text-lg pointer-events-none">
              ∞
            </div>
            <PromptInputToolbar className="absolute right-4 top-1/2 transform -translate-y-1/2">
              <PromptInputTools>
                <PromptInputButton
                  variant="ghost"
                  onClick={() => {/* Add voice functionality here */ }}
                  className="text-gray-400 hover:text-gray-600 p-1 h-8 w-8"
                >
                  <Mic className="w-5 h-5" />
                </PromptInputButton>
              </PromptInputTools>
            </PromptInputToolbar>
          </PromptInput>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-white">
      <div className="w-32 h-1 bg-gray-400 rounded-full mx-auto mt-2 mb-6"></div>

      <div className="px-6 text-center mb-2">
        <h1 className="text-3xl font-light text-gray-800 mb-6">Simon</h1>

        <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center mx-auto mb-6">
          <div className="text-white text-2xl font-bold">∞</div>
        </div>

        <p className="text-gray-600 text-base leading-relaxed mb-8">
          Hello. I am Simon, your personal AI concierge for the finest local recommendations, curated experiences, and exclusive hotel services while you enjoy your stay here.
        </p>

        <h2 className="text-xl font-medium text-gray-800 mb-6">How can I help you?</h2>
      </div>



      <Suggestions className="px-6 space-y-3 mb-6 flex flex-col w-full">
        {suggestions.map((suggestion) => (
          <Suggestion
            key={suggestion.label}
            onClick={() => {
              setOpenL1(true);
              sendMessage(suggestion.action);
            }}
            suggestion={suggestion.label}
            className="w-full flex items-center gap-3 p-4 bg-gray-50 rounded-2xl text-left text-gray-700 transition-colors justify-start"
          >
            <div className="text-gray-500">
              {suggestion.icon}
            </div>
            <span className="text-sm">{suggestion.label}</span>
          </Suggestion>
        ))}
      </Suggestions>

      {errorMessage && (
        <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">Error: {errorMessage}</p>
        </div>
      )}

      <div className="px-6 pb-8 pt-4 mt-auto">
        <PromptInput onSubmit={handleSubmit} className="bg-gray-50 rounded-full border-0 relative">
          <PromptInputTextarea
            onChange={(e) => setInput(e.target.value)}
            value={input}
            placeholder="Ask Simon anything"
            className="bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 resize-none min-h-[50px] rounded-full pl-12 pr-16 pt-4"
          />
          <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-black text-lg pointer-events-none">
            ∞
          </div>
          <PromptInputToolbar className="absolute right-4 top-1/2 transform -translate-y-1/2">
            <PromptInputTools>
              <PromptInputButton
                variant="ghost"
                onClick={() => {/* Add voice functionality here */ }}
                className="text-gray-400 hover:text-gray-600 p-1 h-8 w-8"
              >
                <Mic className="w-5 h-5" />
              </PromptInputButton>
            </PromptInputTools>
          </PromptInputToolbar>
        </PromptInput>
      </div>
    </div>
  );
}



