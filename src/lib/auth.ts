import { useState, useEffect } from 'react';
import { supabase } from './supabase';

export type User = {
  id: string;
  email: string;
  username: string;
  role: 'teacher' | 'student' | 'admin';
  avatar_url?: string;
};

export function useSupabaseUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function getUser() {
      setLoading(true);
      
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        setUser(null);
        setLoading(false);
        return;
      }
      
      // Get user profile
      const { data: profile, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', session.user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user:', error);
        setUser(null);
      } else {
        setUser(profile as User);
      }
      
      setLoading(false);
    }

    getUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        // Get user profile
        supabase
          .from('users')
          .select('*')
          .eq('id', session.user.id)
          .single()
          .then(({ data, error }) => {
            if (error) {
              console.error('Error fetching user on auth change:', error);
              setUser(null);
            } else {
              setUser(data as User);
            }
            setLoading(false);
          });
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return { user, loading };
} 