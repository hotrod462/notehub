import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
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
            try {
              cookieStore.set({ name, value, ...options });
            } catch (error) {
              console.warn('Supabase SSR: Error setting cookie in Route Handler', error);
            }
          },
          remove(name: string, options: CookieOptions) {
            try {
              cookieStore.set({ name, value: '', ...options, maxAge: 0 });
            } catch (error) {
              console.warn('Supabase SSR: Error removing cookie in Route Handler', error);
            }
          },
        },
      }
    );

    try {
      // Exchange the code for a session
      await supabase.auth.exchangeCodeForSession(code);

      // TODO: Step 4 - Trigger user sync/token storage here if needed
      // For now, just redirect

    } catch (error) {
      console.error("Error exchanging code for session:", error);
      // Redirect to an error page or homepage with an error message
      return NextResponse.redirect(`${requestUrl.origin}/auth-error`); // Or just '/'?
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(requestUrl.origin);
} 