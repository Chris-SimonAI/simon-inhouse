'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
  Plus,
  RotateCcw,
  User,
  MapPin,
  Loader2,
  X,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import type { Hotel } from '@/db/schemas/hotels';
import type { GuestPreference } from '@/db/schemas';
import {
  createTestGuest,
  createConversation,
  getGuestPreferencesById,
  deleteGuestPreference,
  resetTestGuestData,
} from '@/actions/test-chat';

interface TestChatClientProps {
  hotels: Hotel[];
  initialGuests: Array<{
    id: number;
    phone: string;
    name: string | null;
    email: string | null;
    hotelId: number | null;
    roomNumber: string | null;
  }>;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  preferencesDetected?: Array<{
    type: string;
    value: string;
    confidence: number;
  }>;
  orderIntent?: {
    restaurantId: number;
    items: Array<{
      menuItemId: number;
      name: string;
      price: number;
      quantity: number;
      modifiers?: string[];
    }>;
    readyToConfirm: boolean;
  } | null;
}

export function TestChatClient({ hotels, initialGuests }: TestChatClientProps) {
  // State
  const [selectedHotelId, setSelectedHotelId] = useState<number | null>(null);
  const [selectedGuest, setSelectedGuest] = useState<typeof initialGuests[0] | null>(null);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [preferences, setPreferences] = useState<GuestPreference[]>([]);
  const [showNewGuestForm, setShowNewGuestForm] = useState(false);
  const [showPreferencesSidebar, setShowPreferencesSidebar] = useState(true);
  const [guests, setGuests] = useState(initialGuests);
  const [error, setError] = useState<string | null>(null);

  // New guest form state
  const [newGuestName, setNewGuestName] = useState('');
  const [newGuestEmail, setNewGuestEmail] = useState('');
  const [newGuestPhone, setNewGuestPhone] = useState('');
  const [newGuestRoom, setNewGuestRoom] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load preferences when guest is selected
  useEffect(() => {
    if (selectedGuest) {
      const loadPrefs = async () => {
        const result = await getGuestPreferencesById(selectedGuest.id);
        if (result.ok) {
          setPreferences(result.data);
        }
      };
      loadPrefs();
    } else {
      setPreferences([]);
    }
  }, [selectedGuest]);

  const loadPreferences = async () => {
    if (!selectedGuest) return;
    const result = await getGuestPreferencesById(selectedGuest.id);
    if (result.ok) {
      setPreferences(result.data);
    }
  };

  const handleSelectHotel = (hotelId: string) => {
    setSelectedHotelId(parseInt(hotelId));
    setSelectedGuest(null);
    setConversationId(null);
    setMessages([]);
    setError(null);
  };

  const handleSelectGuest = async (guestId: string) => {
    const guest = guests.find((g) => g.id === parseInt(guestId));
    if (!guest) return;

    setSelectedGuest(guest);
    setConversationId(null);
    setMessages([]);
    setError(null);
  };

  const startConversation = async () => {
    if (!selectedGuest || !selectedHotelId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await createConversation(selectedGuest.id, selectedHotelId);
      if (result.ok) {
        setConversationId(result.data.id);

        // Add Simon's intro message
        const introMessage: Message = {
          role: 'assistant',
          content: `Hey${selectedGuest.name ? ` ${selectedGuest.name.split(' ')[0]}` : ''}! I'm Simon. I can get you food cheaper than DoorDash or Uber Eats. What sounds good?`,
          timestamp: new Date().toISOString(),
        };
        setMessages([introMessage]);
      } else {
        setError('Failed to start conversation');
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

    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
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
          message: userMessage.content,
        }),
      });

      const data = await response.json();

      if (data.ok) {
        const assistantMessage: Message = {
          role: 'assistant',
          content: data.data.message,
          timestamp: new Date().toISOString(),
          preferencesDetected: data.data.preferencesDetected,
          orderIntent: data.data.orderIntent,
        };
        setMessages((prev) => [...prev, assistantMessage]);

        // Refresh preferences if any were detected
        if (data.data.preferencesDetected?.length > 0) {
          loadPreferences();
        }
      } else {
        setError(data.message || 'Failed to send message');
      }
    } catch (err) {
      setError('Failed to send message');
      console.error(err);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleCreateGuest = async () => {
    if (!newGuestName || !newGuestPhone || !selectedHotelId) return;

    setIsLoading(true);
    setError(null);

    try {
      const result = await createTestGuest({
        name: newGuestName,
        email: newGuestEmail || undefined,
        phone: newGuestPhone,
        hotelId: selectedHotelId,
        roomNumber: newGuestRoom || undefined,
      });

      if (result.ok) {
        const newGuest = {
          id: result.data.id,
          phone: result.data.phone,
          name: result.data.name,
          email: result.data.email,
          hotelId: result.data.hotelId,
          roomNumber: result.data.roomNumber,
        };
        setGuests((prev) => [newGuest, ...prev]);
        setSelectedGuest(newGuest);
        setShowNewGuestForm(false);
        setNewGuestName('');
        setNewGuestEmail('');
        setNewGuestPhone('');
        setNewGuestRoom('');
      } else {
        setError('Failed to create guest');
      }
    } catch (err) {
      setError('Failed to create guest');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetGuest = async () => {
    if (!selectedGuest) return;

    if (!confirm('This will clear all preferences and conversation history for this guest. Continue?')) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await resetTestGuestData(selectedGuest.id);
      if (result.ok) {
        setMessages([]);
        setConversationId(null);
        setPreferences([]);
      } else {
        setError('Failed to reset guest data');
      }
    } catch (err) {
      setError('Failed to reset guest data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePreference = async (preferenceId: number) => {
    try {
      const result = await deleteGuestPreference(preferenceId);
      if (result.ok) {
        setPreferences((prev) => prev.filter((p) => p.id !== preferenceId));
      }
    } catch (err) {
      console.error('Failed to delete preference:', err);
    }
  };

  const selectedHotel = hotels.find((h) => h.id === selectedHotelId);

  // Quick reply suggestions
  const quickReplies = [
    "I'm hungry",
    "maybe thai?",
    "idk just pick something",
    "something light",
    "what's good around here",
  ];

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Test Chat</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Test the conversational ordering experience
            </p>
          </div>
          {selectedGuest && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPreferencesSidebar(!showPreferencesSidebar)}
            >
              {showPreferencesSidebar ? 'Hide' : 'Show'} Preferences
            </Button>
          )}
        </div>

        {/* Selectors */}
        <div className="flex flex-wrap gap-3">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Hotel Location</label>
            <Select value={selectedHotelId?.toString() || ''} onValueChange={handleSelectHotel}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a hotel..." />
              </SelectTrigger>
              <SelectContent>
                {hotels.map((hotel) => (
                  <SelectItem key={hotel.id} value={hotel.id.toString()}>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      {hotel.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedHotelId && (
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-slate-500 mb-1.5 block">Test Guest</label>
              <div className="flex gap-2">
                <Select
                  value={selectedGuest?.id.toString() || ''}
                  onValueChange={handleSelectGuest}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select or create guest..." />
                  </SelectTrigger>
                  <SelectContent>
                    {guests.map((guest) => (
                      <SelectItem key={guest.id} value={guest.id.toString()}>
                        <div className="flex items-center gap-2">
                          <User className="w-3 h-3 text-slate-400" />
                          {guest.name || guest.phone}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewGuestForm(true)}
                  title="Create new test guest"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}

          {selectedGuest && (
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetGuest}
                disabled={isLoading}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                Reset
              </Button>
              {!conversationId && (
                <Button onClick={startConversation} disabled={isLoading}>
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <MessageSquare className="w-4 h-4 mr-2" />
                  )}
                  Start Chat
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex items-center gap-2 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* New Guest Modal */}
      {showNewGuestForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900">Create Test Guest</h2>
              <button
                onClick={() => setShowNewGuestForm(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Name *</label>
                <Input
                  value={newGuestName}
                  onChange={(e) => setNewGuestName(e.target.value)}
                  placeholder="John Smith"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Phone *</label>
                <Input
                  value={newGuestPhone}
                  onChange={(e) => setNewGuestPhone(e.target.value)}
                  placeholder="512-555-1234"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Email</label>
                <Input
                  type="email"
                  value={newGuestEmail}
                  onChange={(e) => setNewGuestEmail(e.target.value)}
                  placeholder="john@example.com"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700 mb-1 block">Room Number</label>
                <Input
                  value={newGuestRoom}
                  onChange={(e) => setNewGuestRoom(e.target.value)}
                  placeholder="101"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowNewGuestForm(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCreateGuest}
                  disabled={!newGuestName || !newGuestPhone || isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Guest'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-slate-50">
          {!conversationId ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-blue-100 flex items-center justify-center">
                  <MessageSquare className="w-8 h-8 text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-slate-900 mb-2">
                  {!selectedHotelId
                    ? 'Select a Hotel'
                    : !selectedGuest
                    ? 'Select or Create a Guest'
                    : 'Ready to Chat'}
                </h2>
                <p className="text-slate-500 text-sm">
                  {!selectedHotelId
                    ? 'Choose a hotel location to see available restaurants and menus.'
                    : !selectedGuest
                    ? 'Select an existing guest or create a new test guest profile.'
                    : 'Click "Start Chat" to begin testing the conversational ordering experience.'}
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <ScrollArea className="flex-1 p-4">
                <div className="max-w-2xl mx-auto space-y-4">
                  {messages.map((message, index) => (
                    <div
                      key={index}
                      className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                          message.role === 'user'
                            ? 'bg-slate-200 text-slate-900'
                            : 'bg-blue-600 text-white'
                        }`}
                      >
                        <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                        {message.preferencesDetected && message.preferencesDetected.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-blue-500/30 flex flex-wrap gap-1">
                            {message.preferencesDetected.map((pref, i) => (
                              <Badge
                                key={i}
                                variant="secondary"
                                className="bg-blue-500/20 text-blue-100 text-[10px]"
                              >
                                {pref.type}: {pref.value}
                              </Badge>
                            ))}
                          </div>
                        )}
                        {message.orderIntent && (
                          <div className="mt-2 pt-2 border-t border-blue-500/30">
                            <p className="text-[10px] text-blue-200 uppercase font-medium mb-1">
                              Order Intent
                            </p>
                            {message.orderIntent.items.map((item, i) => (
                              <div key={i} className="text-xs text-blue-100">
                                {item.quantity}x {item.name} - ${item.price.toFixed(2)}
                              </div>
                            ))}
                            {message.orderIntent.readyToConfirm && (
                              <Badge className="mt-1 bg-green-500 text-white text-[10px]">
                                Ready to confirm
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-blue-600 text-white rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-1">
                          <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <div className="w-2 h-2 bg-blue-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>

              {/* Quick Replies */}
              {messages.length <= 2 && (
                <div className="px-4 pb-2">
                  <div className="max-w-2xl mx-auto">
                    <p className="text-xs text-slate-400 mb-2">Try saying:</p>
                    <div className="flex flex-wrap gap-2">
                      {quickReplies.map((reply, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setInputValue(reply);
                            inputRef.current?.focus();
                          }}
                          className="text-xs bg-white border border-slate-200 rounded-full px-3 py-1.5 text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-colors"
                        >
                          {reply}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Input */}
              <div className="p-4 bg-white border-t border-slate-200">
                <div className="max-w-2xl mx-auto">
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      sendMessage();
                    }}
                    className="flex gap-2"
                  >
                    <Input
                      ref={inputRef}
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      placeholder="Type a message..."
                      disabled={isLoading}
                      className="flex-1"
                    />
                    <Button type="submit" disabled={!inputValue.trim() || isLoading}>
                      {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                    </Button>
                  </form>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Preferences Sidebar */}
        {showPreferencesSidebar && selectedGuest && (
          <div className="w-80 border-l border-slate-200 bg-white flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <h3 className="font-semibold text-slate-900">Guest Preferences</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Learned from conversation
              </p>
            </div>
            <ScrollArea className="flex-1 p-4">
              {preferences.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-slate-100 flex items-center justify-center">
                    <User className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500">No preferences yet</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Preferences will appear as Simon learns from the conversation
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {preferences.map((pref) => (
                    <div
                      key={pref.id}
                      className="bg-slate-50 rounded-lg p-3 group relative"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="text-[10px] capitalize">
                              {pref.preferenceType.replace('_', ' ')}
                            </Badge>
                            <span className="text-[10px] text-slate-400">
                              {Math.round(parseFloat(pref.confidence) * 100)}%
                            </span>
                          </div>
                          <p className="text-sm font-medium text-slate-900 truncate">
                            {pref.preferenceValue}
                          </p>
                          <p className="text-[10px] text-slate-400 mt-0.5 capitalize">
                            Source: {pref.source}
                          </p>
                        </div>
                        <button
                          onClick={() => handleDeletePreference(pref.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Guest Info */}
            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <h4 className="text-xs font-medium text-slate-500 mb-2">Guest Info</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-500">Name</span>
                  <span className="text-slate-900">{selectedGuest.name || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phone</span>
                  <span className="text-slate-900">{selectedGuest.phone}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Room</span>
                  <span className="text-slate-900">{selectedGuest.roomNumber || '-'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Hotel</span>
                  <span className="text-slate-900">{selectedHotel?.name || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
