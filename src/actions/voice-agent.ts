'use server';

import 'server-only';
import { env } from '@/env';
import { getVoiceAgentHotelContext } from '@/lib/voice-agent-context';
import { createSuccess, createError } from '@/lib/utils';
import { CreateSuccess, CreateError } from '@/types/response';

export async function generateVoiceAgentToken(): Promise<CreateSuccess<{ clientSecret: string }> | CreateError<string[]>> {
  try {
      const response = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        session: {
          type: 'realtime',
          model: 'gpt-realtime'
        }
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return createError(
        `Failed to generate voice agent token: ${response.status} ${errorText}`,
        [errorText]
      );
    }

    const result = await response.json();
    
    if (result.client_secret && result.client_secret.value) {
      return createSuccess({ clientSecret: result.client_secret.value });
    } else if (result.value) {
      return createSuccess({ clientSecret: result.value });
    } else {
      return createError(
        'Invalid API response structure',
        ['Missing client_secret or value in response']
      );
    }
  } catch (error) {
    return createError(
      'Failed to generate voice agent token',
      [error instanceof Error ? error.message : 'Unknown error']
    );
  }
}

export async function getVoiceAgentHotelContextAction(hotelId?: number): Promise<CreateSuccess<{ context: string }> | CreateError<string[]>> {
  try {
    if (!hotelId) {
      return createError('Hotel ID is required');
    }
    const context = await getVoiceAgentHotelContext(hotelId);
    return createSuccess({ context });
  } catch (error) {
    return createError(
      'Failed to get hotel context',
      [error instanceof Error ? error.message : 'Unknown error']
    );
  }
}
