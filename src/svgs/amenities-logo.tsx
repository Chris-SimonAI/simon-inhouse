import * as React from "react";
import { SVGProps } from "react";

const AmenitiesLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width={24}
    height={25}
    viewBox="0 0 24 25"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M10 22.5V15.93M12 11.5H12.01M12 7.5H12.01M14 15.93V22.5M15 16.5C14.1345 15.8509 13.0819 15.5 12 15.5C10.9181 15.5 9.86548 15.8509 9 16.5M16 11.5H16.01M16 7.5H16.01M8 11.5H8.01M8 7.5H8.01M6 2.5H18C19.1046 2.5 20 3.39543 20 4.5V20.5C20 21.6046 19.1046 22.5 18 22.5H6C4.89543 22.5 4 21.6046 4 20.5V4.5C4 3.39543 4.89543 2.5 6 2.5Z"
      stroke="black"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export default AmenitiesLogo;
