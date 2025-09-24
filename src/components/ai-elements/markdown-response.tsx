'use client';

import { cn } from '@/lib/utils';
import { type ComponentProps, memo } from 'react';
import { Streamdown } from 'streamdown';
import ReactMarkdown from 'react-markdown';
import { markdownComponents } from '@/components/ui/markdown';

type MarkdownResponseProps = ComponentProps<typeof Streamdown> & {
  enableMarkdown?: boolean;
};

export const MarkdownResponse = memo(
  ({ className, enableMarkdown = false, children, ...props }: MarkdownResponseProps) => {
    if (enableMarkdown && typeof children === 'string') {
      return (
        <div
          className={cn(
            'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 mb-4',
            className
          )}
          {...props}
        >
          <div className="prose max-w-none space-y-6">
            <ReactMarkdown components={markdownComponents}>
              {children}
            </ReactMarkdown>
          </div>
        </div>
      );
    }

    return (
      <Streamdown
        className={cn(
          'size-full [&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
          className
        )}
        {...props}
      >
        {children}
      </Streamdown>
    );
  },
  (prevProps, nextProps) => prevProps.children === nextProps.children
);

MarkdownResponse.displayName = 'MarkdownResponse';
