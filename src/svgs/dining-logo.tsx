import * as React from "react";
import { SVGProps } from "react";

const DiningLogo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    width={24}
    height={25}
    viewBox="0 0 24 25"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      d="M3 2.5V9.5C3 10.6 3.9 11.5 5 11.5H9C9.53043 11.5 10.0391 11.2893 10.4142 10.9142C10.7893 10.5391 11 10.0304 11 9.5V2.5M7 2.5V22.5M21 15.5V2.5C19.6739 2.5 18.4021 3.02678 17.4645 3.96447C16.5268 4.90215 16 6.17392 16 7.5V13.5C16 14.6 16.9 15.5 18 15.5H21ZM21 15.5V22.5"
      stroke="black"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export default DiningLogo;
