"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position="bottom-center"
      toastOptions={{
        duration: 15_000, // 15 seconds

      }}
      closeButton={true}
      offset={{ bottom: '100px' }}
      icons={{
        close: (
          <svg
            aria-label="Close"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        ),
        success: (
          <svg
            aria-label="Success"
            width="16"
            height="16"
            viewBox="0 0 18 19"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            role="img"
          >
            <rect y="0.666504" width="18" height="18" rx="2" fill="white" />
            <path d="M16 0.666504C17.1046 0.666504 18 1.56193 18 2.6665V16.6665C18 17.7711 17.1046 18.6665 16 18.6665H2C0.895431 18.6665 0 17.7711 0 16.6665V2.6665C0 1.56193 0.895431 0.666504 2 0.666504H16ZM14.5059 4.31885C14.0376 4.02624 13.4207 4.16809 13.1279 4.63623L8.31543 12.3364L5.81738 8.79736C5.49896 8.34627 4.875 8.2389 4.42383 8.55713C3.97263 8.87562 3.8651 9.49949 4.18359 9.95068L7.54883 14.7192C7.74192 14.9928 8.05982 15.1515 8.39453 15.1421C8.72907 15.1326 9.03648 14.9562 9.21387 14.6724L12.0195 10.1851L14.8242 5.69678C15.1169 5.22844 14.9742 4.61156 14.5059 4.31885Z" fill="#C28E42" />
          </svg>
        ),
      }}
      className="toaster group "
      style={
        {
          "--normal-bg": "var(--color-popover)",
          "--normal-text": "var(--color-gray-900)",
          "--normal-border": "var(--color-warm)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
