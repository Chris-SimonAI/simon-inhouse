import * as React from "react";
import { SVGProps } from "react";

const HistoryLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width={24}
    height={25}
    viewBox="0 0 24 25"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <g clipPath="url(#clip0_1287_323)">
      <circle cx={12} cy={12.5} r={11.5} stroke="black" />
      <path
        d="M6 12.5C6 13.6867 6.35189 14.8467 7.01118 15.8334C7.67047 16.8201 8.60754 17.5892 9.7039 18.0433C10.8003 18.4974 12.0067 18.6162 13.1705 18.3847C14.3344 18.1532 15.4035 17.5818 16.2426 16.7426C17.0818 15.9035 17.6532 14.8344 17.8847 13.6705C18.1162 12.5067 17.9974 11.3003 17.5433 10.2039C17.0892 9.10754 16.3201 8.17047 15.3334 7.51118C14.3467 6.85189 13.1867 6.5 12 6.5C10.3226 6.50631 8.71265 7.16082 7.50667 8.32667L6 9.83333M6 9.83333V6.5M6 9.83333H9.33333M12 9.16667V12.5L14.6667 13.8333"
        stroke="black"
        strokeWidth={1.33333}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
    <defs>
      <clipPath id="clip0_1287_323">
        <rect
          width={24}
          height={24}
          fill="white"
          transform="translate(0 0.5)"
        />
      </clipPath>
    </defs>
  </svg>
);
export default HistoryLogo;
