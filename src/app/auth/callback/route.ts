import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { encrypt } from '@/lib/encryption.server'; // Import the encrypt function
import { ensureUserRepo } from '@/app/actions/noteActions'; // Import the ensureUserRepo server action

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');

  if (code) {
    const cookieStore = await cookies();

    // Client for exchanging code
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value; },
          set(name: string, value: string, options: CookieOptions) { cookieStore.set({ name, value, ...options }); },
          remove(name: string, options: CookieOptions) { cookieStore.set({ name, value: '', ...options, maxAge: 0 }); },
        },
      }
    );

    try {
      // Exchange the code for a session
      const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

      if (exchangeError) {
        console.error("Error exchanging code for session:", exchangeError);
        return NextResponse.redirect(`${requestUrl.origin}/auth-error?message=${encodeURIComponent(exchangeError.message)}`);
      }

      // --- User Sync & Token Storage --- 
      if (sessionData && sessionData.session && sessionData.user) {
        const session = sessionData.session;
        const user = sessionData.user;

        if (session.provider_token) {
          const encrypted_token = encrypt(session.provider_token);

          // Client for upserting data using Service Role
          // Use dummy cookie methods as service role doesn't rely on browser cookies
          const serviceRoleClient = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!, // Use Service Role Key
            {
              cookies: { 
                get: () => undefined,
                set: () => {}, 
                remove: () => {} 
              },
            }
          );

          // Prepare profile data (check actual keys in user.user_metadata or raw_user_meta_data)
          const profileData = {
            id: user.id,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || '' , // Adjust based on GitHub data
            avatar_url: user.user_metadata?.avatar_url || '',
            github_token_encrypted: encrypted_token,
            // other fields like github_repo_name remain NULL for now
          };

          // Upsert into public.users table
          const { error: upsertError } = await serviceRoleClient
            .from('users')
            .upsert(profileData, { onConflict: 'id' });

          if (upsertError) {
            console.error("Error upserting user profile:", upsertError);
            // Log the error but don't necessarily block login
            // Redirect to homepage, but maybe flash an error message later
          } else {
            console.log("User profile synced successfully for:", user.id);
            
            // --- Ensure GitHub Repo --- 
            // Call ensureUserRepo after successful profile sync
            // We don't need to pass user/token here as the action gets them from cookies
            console.log(`Calling ensureUserRepo for user ${user.id}...`);
            const repoResult = await ensureUserRepo();
            if (repoResult.success) {
                console.log(`ensureUserRepo successful for user ${user.id}. Repo: ${repoResult.repoName}, Created: ${repoResult.created}`);
            } else {
                console.error(`ensureUserRepo failed for user ${user.id}: ${repoResult.error}`);
                // Non-critical error for login flow, log and continue.
                // Could add user-facing notification later if needed.
            }
            // --- End Ensure GitHub Repo ---
          }
        } else {
           console.warn("No provider_token found in session after code exchange for user:", user.id);
        }
      } else {
        console.warn("No session or user data found after code exchange.");
      }
      // --- End User Sync ---

    } catch (error) {
      // Catch any unexpected errors during the process
      console.error("Unexpected error during auth callback:", error);
      return NextResponse.redirect(`${requestUrl.origin}/auth-error?message=An unexpected error occurred`);
    }
  }

  // URL to redirect to after sign in process completes
  return NextResponse.redirect(requestUrl.origin);
} 