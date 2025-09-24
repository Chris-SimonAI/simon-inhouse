import { Components } from "react-markdown";

export const markdownComponents: Components = {
  ul: ({ children, ...props }) => (
    <ul className="list-disc list-inside ml-5 space-y-1 mb-4" {...props}>
      {children}
    </ul>
  ),
  li: ({ children, ...props }) => (
    <li className="text-gray-700" {...props}>
      {children}
    </li>
  ),
  h3: ({ children, ...props }) => (
    <h3 className="font-bold text-lg" {...props}>
      {children}
    </h3>
  ),
  p: ({ children, ...props }) => (
    <p className="mb-4 leading-relaxed" {...props}>
      {children}
    </p>
  ),
};