'use client';

import { VoiceStatus as VoiceStatusType } from '@/hooks/useVoiceAgentConnection';

interface VoiceAnimationProps {
  status: VoiceStatusType;
  isConnecting: boolean;
}

export function VoiceAnimation({ status, isConnecting }: VoiceAnimationProps) {
  const renderAnimation = () => {
    if (isConnecting) {
      return (
        <div className="flex items-center space-x-1">
          {[...Array(9)].map((_, i) => (
            <div
              key={i}
              className="bg-yellow-500 animate-pulse"
              style={{
                width: '3px',
                height: `${12 + (i < 4 ? i * 8 : (8 - i) * 8)}px`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: '1s'
              }}
            />
          ))}
        </div>
      );
    }

    switch (status) {
      case 'listening':
        return (
          <div className="flex items-center space-x-1">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="bg-black animate-pulse"
                style={{
                  width: '3px',
                  height: `${12 + (i < 4 ? i * 8 : (8 - i) * 8)}px`,
                  animationDelay: `${i * 0.1}s`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
        );
      case 'processing':
        return (
          <div className="flex items-center space-x-1">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="bg-blue-500 animate-pulse"
                style={{
                  width: '3px',
                  height: `${12 + (i < 4 ? i * 8 : (8 - i) * 8)}px`,
                  animationDelay: `${i * 0.15}s`,
                  animationDuration: '0.8s'
                }}
              />
            ))}
          </div>
        );
      case 'speaking':
        return (
          <div className="flex items-center space-x-1">
            {[...Array(9)].map((_, i) => (
              <div
                key={i}
                className="bg-green-500 animate-pulse"
                style={{
                  width: '3px',
                  height: `${12 + (i < 4 ? i * 8 : (8 - i) * 8)}px`,
                  animationDelay: `${i * 0.2}s`,
                  animationDuration: '0.6s'
                }}
              />
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="w-32 h-32 mx-auto mb-8 border-4 border-black rounded-full flex items-center justify-center">
      {renderAnimation()}
    </div>
  );
}
