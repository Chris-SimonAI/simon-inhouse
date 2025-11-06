import * as React from "react";
import { SVGProps } from "react";

interface MapPinMarkerProps extends SVGProps<SVGSVGElement> {
  number: number;
}

const MapPinMarker = ({ number, ...props }: MapPinMarkerProps) => (
  <div className="relative flex items-center justify-center drop-shadow-lg">
    <svg
      width="24"
      height="34"
      viewBox="0 0 28 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Map pin teardrop shape */}
      <path
        d="M14 0C6.268 0 0 6.268 0 14C0 22 14 40 14 40C14 40 28 22 28 14C28 6.268 21.732 0 14 0Z"
        fill="#DC2626"
        stroke="none"
        strokeWidth="0"
      />
    </svg>
    <div className="absolute top-[5px] left-1/2 -translate-x-1/2 text-white text-[13px] leading-none flex items-center justify-center w-4 h-4">
      {number}
    </div>
  </div>
);

export default MapPinMarker;

