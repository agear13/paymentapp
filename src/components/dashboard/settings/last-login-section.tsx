'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { formatRelativeTime } from '@/lib/auth/user-agent-parse';

type LastLogin = {
  browser: string | null;
  os: string | null;
  location: string | null;
  relative: string;
};

export function LastLoginSection() {
  const [lastLogin, setLastLogin] = useState<LastLogin | null | undefined>(undefined);

  useEffect(() => {
    void fetch('/api/auth/last-login')
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data?.lastLogin) {
          setLastLogin({
            browser: data.lastLogin.browser,
            os: data.lastLogin.os,
            location: data.lastLogin.location,
            relative: data.lastLogin.relative ?? formatRelativeTime(new Date(data.lastLogin.at)),
          });
        } else {
          setLastLogin(null);
        }
      })
      .catch(() => setLastLogin(null));
  }, []);

  if (lastLogin === undefined) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading last login...
      </div>
    );
  }

  if (!lastLogin) {
    return <p className="text-sm text-muted-foreground">No previous sign-in recorded yet.</p>;
  }

  return (
    <div className="space-y-1 text-sm">
      <p className="font-medium">Last login</p>
      <p className="text-muted-foreground">{lastLogin.browser ?? 'Unknown browser'}</p>
      <p className="text-muted-foreground">{lastLogin.os ?? 'Unknown OS'}</p>
      {lastLogin.location ? (
        <p className="text-muted-foreground">{lastLogin.location}</p>
      ) : null}
      <p className="text-muted-foreground">{lastLogin.relative}</p>
    </div>
  );
}
