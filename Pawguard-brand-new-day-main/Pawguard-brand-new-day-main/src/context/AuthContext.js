import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from 'react';

import { supabase } from '../config/supabase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadSession() {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (error) {
          console.log(
            'GET SESSION ERROR:',
            error.message
          );
        }

        if (!mounted) return;

        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          await loadProfile(session.user.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.log(
          'LOAD SESSION ERROR:',
          error
        );

        if (mounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          await loadProfile(
            newSession.user.id
          );
        } else {
          setProfile(null);
        }

        setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  async function loadProfile(userId) {
    if (!userId) {
      setProfile(null);
      return;
    }

    try {
      const {
        data,
        error,
      } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.log(
          'PROFILE ERROR:',
          error.message
        );

        setProfile(null);
        return;
      }

      setProfile(data ?? null);
    } catch (error) {
      console.log(
        'LOAD PROFILE ERROR:',
        error
      );

      setProfile(null);
    }
  }

  async function signOut() {
    const { error } =
      await supabase.auth.signOut();

    if (error) {
      console.log(
        'SIGN OUT ERROR:',
        error.message
      );
    }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}