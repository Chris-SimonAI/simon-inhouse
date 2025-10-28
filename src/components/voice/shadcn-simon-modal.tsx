'use client';

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export type SimonModalState = 'listening' | 'processing' | 'saying';

interface ShadcnSimonModalProps {
  isOpen: boolean;
  state: SimonModalState;
  onClose: () => void;
  onStopListening?: () => void;
}

export function ShadcnSimonModal({ isOpen, state, onClose, onStopListening }: ShadcnSimonModalProps) {
  const renderAnimation = () => {
    switch (state) {
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
      case 'saying':
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

  const getStatusText = () => {
    switch (state) {
      case 'listening':
        return 'Simon is listening...';
      case 'processing':
        return 'Simon is processing...';
      case 'saying':
        return 'Simon is speaking...';
      default:
        return '';
    }
  };

  const getTapInstruction = () => {
    switch (state) {
      case 'listening':
        return 'Tap anywhere to stop';
      case 'processing':
        return 'Tap to close';
      case 'saying':
        return 'Tap to close';
      default:
        return '';
    }
  };

  const handleModalClick = () => {
    if (state === 'listening') {
      onStopListening?.();
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="h-screen w-full max-w-md mx-auto bg-white p-0 border-0 rounded-none focus:outline-none"
        onClick={handleModalClick}
        showCloseButton={false}
      >
        {/* Hidden accessibility elements */}
        <DialogTitle className="sr-only">
          Simon Voice Assistant - {getStatusText()}
        </DialogTitle>
        <DialogDescription className="sr-only">
          {getTapInstruction()}
        </DialogDescription>

        <div className="flex flex-col h-screen w-full cursor-pointer hover:bg-gray-50 transition-colors">
          <div className="w-32 h-1 bg-gray-400 rounded-full mx-auto mt-2 mb-6"></div>

          <div className="px-6 text-center mb-2 flex-1 flex flex-col justify-center">
            <h1 className="text-3xl font-light text-gray-800 mb-6">Simon</h1>

            {/* Animation container */}
            <div className="w-32 h-32 mx-auto mb-8 border-4 border-black rounded-full flex items-center justify-center">
              {renderAnimation()}
            </div>

            {/* Status text */}
            <p className="text-gray-600 text-base leading-relaxed mb-4">
              {getStatusText()}
            </p>

            {/* Tap instruction */}
            <p className="text-gray-500 text-sm mb-8">
              {getTapInstruction()}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
