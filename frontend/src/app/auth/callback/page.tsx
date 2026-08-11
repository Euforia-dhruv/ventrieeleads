'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function CallbackHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const refreshToken = searchParams.get('refreshToken');
    const err = searchParams.get('error');

    if (err) {
      const errorMessages: Record<string, string> = {
        google_denied: 'You denied the Google sign-in request.',
        missing_code: 'Authentication failed. Please try again.',
        google_not_configured: 'Google sign-in is not configured.',
        google_no_email: 'Google did not provide an email address.',
        google_auth_failed: 'Google authentication failed. Please try again.',
      };
      setError(errorMessages[err] || 'An error occurred during authentication.');
      return;
    }

    if (token && refreshToken) {
      localStorage.setItem('token', token);
      localStorage.setItem('refreshToken', refreshToken);
      document.cookie = `token=${token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
      router.replace('/');
      router.refresh();
    } else {
      setError('No authentication token received. Please try again.');
    }
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="text-center max-w-md">
          <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm mb-4">{error}</div>
          <a href="/login" className="text-primary hover:underline text-sm">
            Return to login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
        <p className="text-muted-foreground text-sm">Completing sign-in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-background">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <CallbackHandler />
    </Suspense>
  );
}
