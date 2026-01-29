'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Send,
  Loader2,
  ChevronLeft,
  User,
  X,
  MapPin,
  Utensils,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  createTestGuest,
  createConversation,
  getGuestPreferencesById,
} from '@/actions/test-chat';
import { getAllHotels } from '@/actions/hotels';
import { getGuestProfiles } from '@/actions/guest-profiles';
import type { Hotel } from '@/db/schemas/hotels';
import type { GuestPreference } from '@/db/schemas';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface Guest {
  id: number;
  name: string | null;
  phone: string;
  roomNumber: string | null;
}

export default function MobileChatPage() {
  // Data state
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [guests, setGuests] = useState<Guest[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Selection state
  const [selectedHotelId, setSelectedHotelId] = useState<number | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<Guest | null>(null);
  const [showSetup, setShowSetup] = useState(true);

  // Chat state
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Preferences state
  const [preferences, setPreferences] = useState<GuestPreference[]>([]);
  const [showPreferences, setShowPreferences] = useState(false);

  // New guest form
  const [showNewGuest, setShowNewGuest] = useState(false);
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const [hotelsResult, guestsResult] = await Promise.all([
          getAllHotels(),
          getGuestProfiles({ limit: 100 }),
        ]);
        if (hotelsResult.ok && hotelsResult.data) {
          setHotels(hotelsResult.data);
        }
        if (guestsResult.guests) {
          setGuests(guestsResult.guests);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
      } finally {
        setIsLoadingData(false);
      }
    }
    loadData();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load preferences when guest changes
  useEffect(() => {
    if (selectedGuest) {
      loadPreferences(selectedGuest.id);
    }
  }, [selectedGuest]);

  const loadPreferences = async (guestId: number) => {
    const result = await getGuestPreferencesById(guestId);
    if (result.ok) {
      setPreferences(result.data);
    }
  };

  const formatPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    return phone;
  };

  const startConversation = async () => {
    if (!selectedGuest || !selectedHotelId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await createConversation(selectedGuest.id, selectedHotelId);
      if (result.ok) {
        setConversationId(result.data.id);
        setShowSetup(false);
        setMessages([
          {
            role: 'assistant',
            content: `Hey${selectedGuest.name ? ` ${selectedGuest.name.split(' ')[0]}` : ''}! I'm Simon. I can get you food cheaper than DoorDash or Uber Eats. What sounds good?`,
          },
        ]);
        setTimeout(() => inputRef.current?.focus(), 100);
      }
    } catch (err) {
      setError('Failed to start conversation');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputValue.trim() || !conversationId || !selectedGuest || !selectedHotelId || isLoading) {
      return;
    }

    const userMessage = inputValue.trim();
    setInputValue('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/test-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          guestId: selectedGuest.id,
          hotelId: selectedHotelId,
          message: userMessage,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.data.message }]);
        await loadPreferences(selectedGuest.id);
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch (err) {
      setError('Failed to send message');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleQuickReply = async (reply: string) => {
    if (!conversationId || !selectedGuest || !selectedHotelId || isLoading) return;

    setMessages((prev) => [...prev, { role: 'user', content: reply }]);
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/admin/test-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          guestId: selectedGuest.id,
          hotelId: selectedHotelId,
          message: reply,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        setMessages((prev) => [...prev, { role: 'assistant', content: data.data.message }]);
        await loadPreferences(selectedGuest.id);
      } else {
        setError(data.error || 'Failed to send message');
      }
    } catch (err) {
      setError('Failed to send message');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const createNewGuest = async () => {
    if (!newGuestName || !newGuestPhone || !selectedHotelId) return;

    setIsLoading(true);
    try {
      const result = await createTestGuest({
        name: newGuestName,
        phone: newGuestPhone,
        hotelId: selectedHotelId,
      });

      if (result.ok) {
        const newGuest = {
          id: result.data.id,
          name: result.data.name,
          phone: result.data.phone,
          roomNumber: result.data.roomNumber,
        };
        setGuests((prev) => [newGuest, ...prev]);
        setSelectedGuest(newGuest);
        setShowNewGuest(false);
        setNewGuestName('');
        setNewGuestPhone('');
      }
    } catch (err) {
      console.error('Failed to create guest:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const quickReplies = [
    "I'm hungry",
    "Something healthy",
    "What's good?",
    "Surprise me",
  ];

  // Loading state
  if (isLoadingData) {
    return (
      <div className="h-full bg-gradient-to-b from-blue-600 to-blue-700 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Utensils className="w-8 h-8 text-blue-600" />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-white mx-auto" />
        </div>
      </div>
    );
  }

  // Setup screen
  if (showSetup) {
    return (
      <div className="h-full bg-gradient-to-b from-blue-600 to-blue-700 flex flex-col">
        {/* Hero Section */}
        <div className="pt-16 pb-10 px-6 text-center safe-area-top">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Utensils className="w-10 h-10 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">Simon</h1>
          <p className="text-blue-200 text-sm">Internal Demo</p>
        </div>

        {/* Form Card */}
        <div className="flex-1 bg-white rounded-t-3xl px-6 pt-8 pb-6 overflow-auto">
          <div className="space-y-6">
            {/* Hotel Selection */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                <MapPin className="w-4 h-4" />
                Hotel Location
              </label>
              <Select
                value={selectedHotelId?.toString() || ''}
                onValueChange={(val) => setSelectedHotelId(parseInt(val))}
              >
                <SelectTrigger className="w-full h-12 rounded-xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 data-[state=open]:ring-2 data-[state=open]:ring-blue-500 data-[state=open]:border-blue-500">
                  <SelectValue placeholder="Select your hotel..." />
                </SelectTrigger>
                <SelectContent>
                  {hotels.map((hotel) => (
                    <SelectItem key={hotel.id} value={hotel.id.toString()}>
                      {hotel.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Guest Selection */}
            {selectedHotelId && (
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
                  <User className="w-4 h-4" />
                  Guest Profile
                </label>
                {!showNewGuest ? (
                  <>
                    <Select
                      value={selectedGuest?.id.toString() || ''}
                      onValueChange={(val) => {
                        const guest = guests.find((g) => g.id === parseInt(val));
                        setSelectedGuest(guest || null);
                      }}
                    >
                      <SelectTrigger className="w-full h-12 rounded-xl border-slate-200 bg-slate-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 data-[state=open]:ring-2 data-[state=open]:ring-blue-500 data-[state=open]:border-blue-500">
                        <SelectValue placeholder="Select guest profile..." />
                      </SelectTrigger>
                      <SelectContent>
                        {guests.map((guest) => (
                          <SelectItem key={guest.id} value={guest.id.toString()}>
                            <div className="flex flex-col items-start">
                              <span className="font-medium">{guest.name || 'Unnamed Guest'}</span>
                              <span className="text-xs text-slate-500">
                                {formatPhone(guest.phone)}
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => setShowNewGuest(true)}
                      className="mt-3 text-sm text-blue-600 font-medium hover:text-blue-700"
                    >
                      + Create new guest profile
                    </button>
                  </>
                ) : (
                  <div className="space-y-3 bg-slate-50 p-4 rounded-xl">
                    <Input
                      placeholder="Guest name"
                      value={newGuestName}
                      onChange={(e) => setNewGuestName(e.target.value)}
                      className="h-11 rounded-lg border-slate-200"
                    />
                    <Input
                      placeholder="Phone number"
                      value={newGuestPhone}
                      onChange={(e) => setNewGuestPhone(e.target.value)}
                      className="h-11 rounded-lg border-slate-200"
                    />
                    <div className="flex gap-2 pt-1">
                      <Button
                        onClick={createNewGuest}
                        disabled={!newGuestName || !newGuestPhone || isLoading}
                        className="flex-1 h-11 rounded-lg bg-blue-600 hover:bg-blue-700"
                      >
                        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => setShowNewGuest(false)}
                        className="h-11 rounded-lg"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Start Button - Fixed at bottom */}
          {selectedHotelId && selectedGuest && (
            <div className="mt-8">
              <Button
                onClick={startConversation}
                disabled={isLoading}
                className="w-full h-14 text-base font-semibold rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-600/30"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  'Start Chatting'
                )}
              </Button>
              <p className="text-center text-xs text-slate-400 mt-3">
                Cheaper than DoorDash. No fees.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Chat screen
  return (
    <div className="h-full bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center gap-3 safe-area-top">
        <button
          onClick={() => {
            setShowSetup(true);
            setConversationId(null);
            setMessages([]);
          }}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 -ml-1"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center">
          <Utensils className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1">
          <h1 className="font-semibold leading-tight">Simon</h1>
          <p className="text-xs text-blue-100 leading-tight">
            {hotels.find((h) => h.id === selectedHotelId)?.name}
          </p>
        </div>
        <button
          onClick={() => setShowPreferences(!showPreferences)}
          className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10"
        >
          {showPreferences ? (
            <X className="w-5 h-5" />
          ) : (
            <User className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Preferences Drawer */}
      {showPreferences && (
        <div className="bg-white border-b border-slate-100 px-4 py-4 max-h-[40vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">Learned Preferences</h3>
            <span className="text-sm text-slate-500">{selectedGuest?.name}</span>
          </div>
          {preferences.length > 0 ? (
            <div className="space-y-2">
              {preferences.map((pref) => (
                <div
                  key={pref.id}
                  className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3"
                >
                  <div>
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs font-medium mb-1">
                      {pref.preferenceType}
                    </Badge>
                    <p className="text-sm font-medium text-slate-900">{pref.preferenceValue}</p>
                  </div>
                  <span className="text-sm font-medium text-slate-400">
                    {Math.round(parseFloat(pref.confidence) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-slate-500">No preferences learned yet.</p>
              <p className="text-xs text-slate-400 mt-1">Simon learns as you chat!</p>
            </div>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        <div className="space-y-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-2 flex-shrink-0 mt-1">
                  <Utensils className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-white text-slate-900 shadow-sm rounded-bl-md'
                }`}
              >
                <p className="text-[15px] leading-relaxed">{message.content}</p>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mr-2 flex-shrink-0">
                <Utensils className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
          {error}
        </div>
      )}

      {/* Quick Replies */}
      {messages.length === 1 && !isLoading && (
        <div className="px-4 pb-3">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {quickReplies.map((reply) => (
              <button
                key={reply}
                onClick={() => handleQuickReply(reply)}
                className="flex-shrink-0 px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-sm"
              >
                {reply}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t border-slate-100 px-4 py-3 safe-area-bottom">
        <div className="flex gap-3">
          <input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Simon..."
            disabled={isLoading}
            className="flex-1 h-12 rounded-full bg-slate-100 px-5 text-[15px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            <Send className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
