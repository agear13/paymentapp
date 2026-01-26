'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function DebugPage() {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const supabase = createClient();
        
        // Check if Supabase is configured
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const hasAnonKey = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        
        // Try to get session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        // Try to get user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        setInfo({
          supabaseUrl,
          hasAnonKey,
          session: sessionData?.session ? 'Found' : 'None',
          sessionError: sessionError?.message,
          user: userData?.user ? userData.user.email : 'None',
          userError: userError?.message,
          cookies: document.cookie,
        });
      } catch (error: any) {
        setInfo({ error: error.message });
      } finally {
        setLoading(false);
      }
    }
    
    checkAuth();
  }, []);

  if (loading) {
    return <div className="p-8">Loading debug info...</div>;
  }

  return (
    <div className="p-8 font-mono text-sm">
      <h1 className="text-2xl font-bold mb-4">Auth Debug Info</h1>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(info, null, 2)}
      </pre>
      
      <div className="mt-4">
        <a href="/auth/login" className="text-blue-600 underline">
          Go to Login Page
        </a>
      </div>
    </div>
  );
}

