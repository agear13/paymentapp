'use client';

import * as React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

type MaskedCredentialInputProps = {
  value: string;
  onChange: (value: string) => void;
  mask: (value: string) => string;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
};

export function MaskedCredentialInput({
  value,
  onChange,
  mask,
  placeholder,
  disabled,
  id,
}: MaskedCredentialInputProps) {
  const [revealed, setRevealed] = React.useState(false);
  const hasStored = Boolean(value.trim());
  const showMasked = hasStored && !revealed;

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="text"
        autoComplete="off"
        placeholder={placeholder}
        disabled={disabled}
        value={showMasked ? mask(value) : value}
        onChange={(e) => {
          setRevealed(true);
          onChange(e.target.value);
        }}
        onFocus={() => {
          if (hasStored) setRevealed(true);
        }}
        className="font-mono text-sm"
      />
      {hasStored ? (
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="shrink-0"
          disabled={disabled}
          onClick={() => setRevealed((r) => !r)}
          aria-label={revealed ? 'Hide value' : 'Show value'}
        >
          {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      ) : null}
    </div>
  );
}
