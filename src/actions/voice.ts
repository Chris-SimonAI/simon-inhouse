'use server';

import 'server-only';
import { env } from '@/env';

export async function convertSpeechToText(audioBlob: Blob): Promise<{ text: string }> {
  try {
    // Convert Blob to File for OpenAI API
    const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
    
    // Use direct OpenAI API for transcription (LangChain doesn't support audio input yet)
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('model', 'whisper-1');
    formData.append('language', 'en');
    
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API Error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return { text: result.text };
  } catch (error) {
    console.error('STT Error:', error);
    throw new Error('Failed to convert speech to text');
  }
}

export async function convertTextToSpeech(text: string): Promise<{ audioUrl: string }> {
  try {
    // For TTS, we still need to use the direct OpenAI API as LangChain doesn't have TTS support yet
    // But we can use the same client instance
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'tts-1',
        voice: 'alloy',
        input: text,
        response_format: 'mp3',
      }),
    });

    if (!response.ok) {
      throw new Error(`TTS API error: ${response.statusText}`);
    }

    // Convert response to base64 URL for client-side playback
    const buffer = Buffer.from(await response.arrayBuffer());
    const base64 = buffer.toString('base64');
    const audioUrl = `data:audio/mp3;base64,${base64}`;

    return { audioUrl };
  } catch (error) {
    console.error('TTS Error:', error);
    throw new Error('Failed to convert text to speech');
  }
}
