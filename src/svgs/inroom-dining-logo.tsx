import * as React from "react";
import { SVGProps } from "react";

const InRoomDiningLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width={24}
    height={25}
    viewBox="0 0 24 25"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <rect x={2} y={19.5} width={20} height={3} rx={1} stroke="black" />
    <path
      d="M12 6.5C13.1046 6.5 14 5.60457 14 4.5C14 3.39543 13.1046 2.5 12 2.5C10.8954 2.5 10 3.39543 10 4.5C10 5.60457 10.8954 6.5 12 6.5Z"
      stroke="black"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M12 16.5C17.5228 16.5 22 16.5 22 16.5C22 10.9772 17.5228 5.5 12 5.5C6.47715 5.5 2 10.9772 2 16.5C2 16.5 6.47715 16.5 12 16.5Z"
      fill="white"
      stroke="black"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export default InRoomDiningLogo;
