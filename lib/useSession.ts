'use client';

import { useState, useEffect } from 'react';

interface User {
  id: string;
  email: string;
  name: string;
}

interface SessionState {
  data: { user: User } | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
}

export function useCustomSession() {
  const [session, setSession] = useState<SessionState>({
    data: null,
    status: 'loading',
  });

  useEffect(() => {
    async function fetchSession() {
      try {
        // Tentar pegar token do localStorage
        const token = localStorage.getItem('session_token');
        
        if (!token) {
          setSession({ data: null, status: 'unauthenticated' });
          return;
        }

        // Verificar sessão com o servidor
        const res = await fetch('/api/auth/session', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });

        if (!res.ok) {
          localStorage.removeItem('session_token');
          setSession({ data: null, status: 'unauthenticated' });
          return;
        }

        const data = await res.json();
        
        if (data.authenticated && data.user) {
          setSession({ data: { user: data.user }, status: 'authenticated' });
        } else {
          localStorage.removeItem('session_token');
          setSession({ data: null, status: 'unauthenticated' });
        }
      } catch (error) {
        console.error('[useCustomSession] Error:', error);
        setSession({ data: null, status: 'unauthenticated' });
      }
    }

    fetchSession();
  }, []);

  return session;
}