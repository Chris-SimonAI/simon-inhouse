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
  MessageSquare,
  Send,
  Loader2,
  ChevronLeft,
  User,
  Settings2,
  X,
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
        // Send intro message
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
        // Refresh preferences
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
      <div className="h-full bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  // Setup screen
  if (showSetup) {
    return (
      <div className="h-full bg-slate-50 flex flex-col">
        {/* Header */}
        <div className="bg-blue-600 text-white px-4 py-4 safe-area-top">
          <h1 className="text-lg font-semibold">Simon Demo</h1>
          <p className="text-blue-100 text-sm">Test the ordering experience</p>
        </div>

        <div className="flex-1 p-4 space-y-6">
          {/* Hotel Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Hotel Location
            </label>
            <Select
              value={selectedHotelId?.toString() || ''}
              onValueChange={(val) => setSelectedHotelId(parseInt(val))}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select hotel..." />
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
              <label className="block text-sm font-medium text-slate-700 mb-2">
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
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select guest..." />
                    </SelectTrigger>
                    <SelectContent>
                      {guests.map((guest) => (
                        <SelectItem key={guest.id} value={guest.id.toString()}>
                          <div className="flex flex-col">
                            <span>{guest.name || 'Unnamed Guest'}</span>
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
                    className="mt-2 text-sm text-blue-600 font-medium"
                  >
                    + Create new guest
                  </button>
                </>
              ) : (
                <div className="space-y-3 bg-white p-4 rounded-lg border">
                  <Input
                    placeholder="Name"
                    value={newGuestName}
                    onChange={(e) => setNewGuestName(e.target.value)}
                  />
                  <Input
                    placeholder="Phone"
                    value={newGuestPhone}
                    onChange={(e) => setNewGuestPhone(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      onClick={createNewGuest}
                      disabled={!newGuestName || !newGuestPhone}
                      className="flex-1"
                    >
                      Create
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => setShowNewGuest(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Start Button */}
          {selectedHotelId && selectedGuest && (
            <Button
              onClick={startConversation}
              disabled={isLoading}
              className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <MessageSquare className="w-5 h-5 mr-2" />
                  Start Chat
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    );
  }

  // Chat screen
  return (
    <div className="h-full bg-slate-100 flex flex-col">
      {/* Header */}
      <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between safe-area-top">
        <button
          onClick={() => {
            setShowSetup(true);
            setConversationId(null);
            setMessages([]);
          }}
          className="p-1 -ml-1"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex-1 text-center">
          <h1 className="font-semibold">Simon</h1>
          <p className="text-xs text-blue-100">
            {hotels.find((h) => h.id === selectedHotelId)?.name}
          </p>
        </div>
        <button
          onClick={() => setShowPreferences(!showPreferences)}
          className="p-1 -mr-1"
        >
          {showPreferences ? (
            <X className="w-5 h-5" />
          ) : (
            <Settings2 className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Preferences Drawer */}
      {showPreferences && (
        <div className="bg-white border-b px-4 py-3 max-h-[40vh] overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-medium text-slate-900">Guest Profile</h3>
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <User className="w-4 h-4" />
              {selectedGuest?.name || 'Guest'}
            </div>
          </div>
          {preferences.length > 0 ? (
            <div className="space-y-2">
              {preferences.map((pref) => (
                <div
                  key={pref.id}
                  className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-2"
                >
                  <div>
                    <Badge variant="outline" className="text-xs mb-1">
                      {pref.preferenceType}
                    </Badge>
                    <p className="text-sm font-medium">{pref.preferenceValue}</p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {Math.round(parseFloat(pref.confidence) * 100)}%
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No preferences learned yet. Start chatting!
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-900 shadow-sm'
              }`}
            >
              <p className="text-[15px] leading-relaxed">{message.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-4 mb-2 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Quick Replies */}
      {messages.length === 1 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto">
          {quickReplies.map((reply) => (
            <button
              key={reply}
              onClick={async () => {
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
              }}
              className="flex-shrink-0 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm text-slate-700 hover:bg-slate-50"
            >
              {reply}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="bg-white border-t px-4 py-3 safe-area-bottom">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Message Simon..."
            className="flex-1 h-11 rounded-full bg-slate-100 border-0 px-4"
            disabled={isLoading}
          />
          <Button
            onClick={sendMessage}
            disabled={!inputValue.trim() || isLoading}
            size="icon"
            className="h-11 w-11 rounded-full bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
