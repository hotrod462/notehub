"use server";

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export async function signInWithGithub() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      scopes: 'repo', // Request repository access
      redirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`, // Ensure this matches expected callback logic
    },
  });

  if (error) {
    console.error('Error signing in with GitHub:', error);
    // Redirect to an error page or return an error state
    redirect('/auth-error?message=' + encodeURIComponent(error.message));
  }

  if (data.url) {
    redirect(data.url); // Redirect the user to GitHub for authorization
  } else {
    // Handle unexpected case where there's no error but also no URL
    redirect('/auth-error?message=Could not get GitHub redirect URL');
  }
}

export async function signOut() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          cookieStore.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          cookieStore.set({ name, value: '', ...options, maxAge: 0 });
        },
      },
    }
  );

  const { error } = await supabase.auth.signOut();

  if (error) {
    console.error('Error signing out:', error);
    // Optionally redirect to an error page or handle differently
    redirect('/auth-error?message=' + encodeURIComponent(error.message));
  }

  redirect('/'); // Redirect to the homepage after sign out
} 