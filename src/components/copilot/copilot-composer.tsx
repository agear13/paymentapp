'use client';

import * as React from 'react';
import { SendHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export function CopilotComposer({
  onSend,
  disabled,
  className,
}: {
  onSend: (text: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  const [value, setValue] = React.useState('');

  const submit = () => {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue('');
  };

  return (
    <div className={cn('border-t bg-background p-3', className)}>
      <div className="flex gap-2">
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Message Copilot…"
          disabled={disabled}
          rows={2}
          className="min-h-[52px] resize-none text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <Button
          type="button"
          size="icon"
          className="h-[52px] w-11 shrink-0"
          disabled={disabled || !value.trim()}
          onClick={submit}
          aria-label="Send message"
        >
          <SendHorizontal className="size-4" />
        </Button>
      </div>
      <p className="text-muted-foreground mt-1.5 text-[10px] leading-snug">
        Enter to send · Shift+Enter for newline · Backend chat not connected yet
      </p>
    </div>
  );
}
