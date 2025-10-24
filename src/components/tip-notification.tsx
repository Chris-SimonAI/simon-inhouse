"use client";

import React, { useEffect, useState, useCallback } from "react";
import { CheckCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface TipNotificationProps {
  isVisible: boolean;
  amount: string;
  onClose: () => void;
  autoCloseDelay?: number;
}

export function TipNotification({ 
  isVisible, 
  amount, 
  onClose, 
  autoCloseDelay = 8000 
}: TipNotificationProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  const handleClose = useCallback(() => {
    setIsAnimating(false);
    // Wait for fade-out animation to complete before calling onClose
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    if (isVisible) {
      setIsAnimating(true);
      
      // Auto-close after specified delay
      const timer = setTimeout(() => {
        handleClose();
      }, autoCloseDelay);

      return () => clearTimeout(timer);
    }
  }, [isVisible, autoCloseDelay, handleClose]);

  if (!isVisible) return null;

  return (
    <div className="w-full">
      <div
        className={cn(
          "bg-white rounded-lg shadow-sm border border-gray-200 p-4 w-full",
          "transition-all duration-300 ease-in-out",
          isAnimating 
            ? "opacity-100 translate-y-0 scale-100" 
            : "opacity-0 translate-y-2 scale-95"
        )}
      >
        <div className="flex items-start gap-3">
          {/* Success Icon */}
          <div className="flex-shrink-0">
            <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
          </div>
          
          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">
                Tip Sent
              </h3>
              <button
                onClick={handleClose}
                className="flex-shrink-0 ml-2 p-1 rounded-full hover:bg-gray-100 transition-colors"
                aria-label="Close notification"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <p className="text-sm text-gray-600 mt-1">
              Your tip for ${amount} was sent.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}