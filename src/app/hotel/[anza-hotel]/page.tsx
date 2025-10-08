'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import AnzaHotelLogo from '@/svgs/anza-hotel-logo';

export default function HotelPage() {
    return (
        <div className="fixed inset-0 w-screen h-screen overflow-hidden">
            {/* Background Image */}
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{
                    backgroundImage: 'url(/hotel/anza-hotel.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center center'
                }}
            />

            {/* Black Shadow Overlay */}
            <div
                className="absolute inset-0"
                style={{
                    background: 'linear-gradient(to right, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0.5) 50%, rgba(0,0,0,0.6) 100%)'
                }}
            />

            {/* Hotel Logo Overlay - Hidden on mobile, visible on desktop */}
            <div
                className="hidden lg:flex absolute items-center justify-center w-[200px] h-[200px] top-[80px]"
                style={{
                    left: 'calc(50% - 300px)'
                }}
            >
                <AnzaHotelLogo />
            </div>

            {/* White Card Overlay - Responsive */}
            <div
                className={cn(
                    "absolute bg-[#FFFFFFE5] border-4 border-white",
                    "flex flex-col justify-between items-center",
                    "rounded-[24px]",
                    // Mobile: Full width with margins
                    "w-[calc(100%-20px)] h-[calc(100vh-20px)]",
                    "top-[10px] left-[10px] right-[10px]",
                    "pt-8 pr-4 pb-8 pl-4",
                    // Desktop: Fixed width on right
                    "lg:w-[500px] lg:h-[calc(100vh-20px)]",
                    "lg:top-[10px] lg:right-[10px] lg:left-auto",
                    "lg:pt-24 lg:pr-6 lg:pb-24 lg:pl-6",
                    "opacity-100"
                )}
            >
                {/* Header */}
                <div className="text-center">
                    <h1 className="text-4xl sm:text-3xl lg:text-3xl font-bold text-black mb-4">
                        Meet Simon
                    </h1>

                    {/* Logo */}
                    <div className="w-20 h-20 flex items-center justify-center mb-6 lg:mb-8 mx-auto">
                        <Image
                            src="/logo.png"
                            alt="Simon Logo"
                            width={100}
                            height={100}
                            className="w-full h-full object-contain"
                        />
                    </div>

                    {/* Description */}
                    <p className="text-black text-center text-lg sm:text-base lg:text-sm leading-relaxed mb-6 lg:mb-8 px-2">
                        Your personal AI concierge for the finest local recommendations, curated experiences, and exclusive hotel services while you enjoy your stay.
                    </p>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center justify-center flex-1 lg:flex-none">
                    <div className="w-[120px] h-[120px] sm:w-[140px] sm:h-[140px] lg:w-[160px] lg:h-[160px] bg-white border-2 border-gray-300 rounded-lg flex items-center justify-center mb-4 lg:mb-6">
                        <Image
                            src="/hotel/qr_code.png"
                            alt="QR Code to access Simon"
                            width={160}
                            height={160}
                            className="rounded-lg w-full h-full object-contain"
                        />
                    </div>

                    {/* Instruction */}
                    <p className="text-black text-2xl sm:text-xl lg:text-lg text-center font-[400] px-2">
                        Scan the QR code to access Simon
                    </p>
                </div>
            </div>
        </div>
    );
}
