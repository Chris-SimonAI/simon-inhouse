'use client';

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

type AddressInputProps = {
  defaultValue?: string;
  onPlaceSelect?: (place: {
    address: string;
    latitude: number;
    longitude: number;
  }) => void;
  onChange?: (address: string) => void;
};

declare global {
  interface Window {
    initGooglePlaces: () => void;
  }
}

export function AddressInput({ defaultValue, onPlaceSelect, onChange }: AddressInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Check if Google Maps is already loaded
    if (window.google?.maps?.places) {
      setIsLoaded(true);
      return;
    }

    // Load Google Maps script
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || apiKey === 'dummy') {
      console.warn('Google Maps API key not configured');
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => setIsLoaded(true);
    document.head.appendChild(script);

    return () => {
      // Cleanup if needed
    };
  }, []);

  useEffect(() => {
    if (!isLoaded || !inputRef.current || autocompleteRef.current) return;

    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      fields: ['formatted_address', 'geometry'],
    });

    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current?.getPlace();
      if (place?.geometry?.location && place.formatted_address) {
        onPlaceSelect?.({
          address: place.formatted_address,
          latitude: place.geometry.location.lat(),
          longitude: place.geometry.location.lng(),
        });
      }
    });
  }, [isLoaded, onPlaceSelect]);

  return (
    <Input
      ref={inputRef}
      id="address"
      name="address"
      defaultValue={defaultValue}
      placeholder="Start typing an address..."
      autoComplete="off"
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
}
