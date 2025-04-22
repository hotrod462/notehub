"use server";

import { cookies } from 'next/headers';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { decrypt } from '@/lib/encryption.server';
import {
  getGithubUser,
  checkRepoExists,
  createGithubRepo,
} from '@/lib/githubService.server';
import { revalidatePath } from 'next/cache';

// Define a standard repo name (can be made configurable later)
const DRAFTER_REPO_NAME = 'drafter-repo';

// Helper function to perform the repo check and creation logic
async function checkAndCreateRepoIfNeeded(
  token: string,
  owner: string
): Promise<{ repoExisted: boolean; repoName: string; error?: string }> {
  try {
    const repoExists = await checkRepoExists(token, owner, DRAFTER_REPO_NAME);
    let repoFullName = `${owner}/${DRAFTER_REPO_NAME}`;

    if (!repoExists) {
      console.log(`Repository ${repoFullName} not found. Creating...`);
      const createdRepo = await createGithubRepo(token, DRAFTER_REPO_NAME);
      repoFullName = createdRepo.full_name;
      console.log(`Repository ${repoFullName} created successfully.`);
      revalidatePath('/notes');
      return { repoExisted: false, repoName: DRAFTER_REPO_NAME };
    } else {
      console.log(`Repository ${repoFullName} already exists.`);
      revalidatePath('/notes');
      return { repoExisted: true, repoName: DRAFTER_REPO_NAME };
    }
  } catch (error: any) {
    console.error('Error ensuring repository:', error);
    return { repoExisted: false, repoName: '', error: error.message || 'Failed to ensure GitHub repository.' };
  }
}

export async function ensureUserRepo(): Promise<{ success: boolean; repoName?: string; error?: string }> {
  const cookieStore = await cookies();

  // 1. Get user session
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookieStore.get(name)?.value,
        set: (name, value, options) => cookieStore.set({ name, value, ...options }),
        remove: (name, options) => cookieStore.set({ name, value: '', ...options, maxAge: 0 }),
      },
    }
  );

  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error getting user:', userError);
    return { success: false, error: 'User not authenticated.' };
  }

  // 2. Get user profile from public.users
  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('github_repo_name, github_token_encrypted')
    .eq('id', user.id)
    .single();

  if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = Row not found
    console.error('Error fetching user profile:', profileError);
    return { success: false, error: 'Could not fetch user profile.' };
  }

  // 4. Decrypt token (needed regardless of profile state now)
  if (!profile?.github_token_encrypted) {
    return { success: false, error: 'Encrypted GitHub token not found in profile.' };
  }
  const decryptedToken = decrypt(profile.github_token_encrypted);
  if (!decryptedToken) {
    return { success: false, error: 'Failed to decrypt GitHub token.' };
  }

  try {
    // 5. Get GitHub username
    const githubUser = await getGithubUser(decryptedToken);
    const owner = githubUser.login;

    // 6. Check/Create Repo
    const repoCheckResult = await checkAndCreateRepoIfNeeded(decryptedToken, owner);

    if (repoCheckResult.error) {
      return { success: false, error: repoCheckResult.error };
    }

    // 7. Update profile only if repo name wasn't already stored or repo was just created
    if (!profile?.github_repo_name || !repoCheckResult.repoExisted) {
      console.log(`Updating profile for user ${user.id} with repo name: ${repoCheckResult.repoName}`);
      const { error: updateError } = await supabase
        .from('users')
        .update({ github_repo_name: repoCheckResult.repoName })
        .eq('id', user.id);

      if (updateError) {
        console.error('Error updating profile with repo name:', updateError);
        // Return success but include the update error message
        return { success: true, repoName: repoCheckResult.repoName, error: 'Failed to save repo name to profile.' };
      }
    } else {
        console.log(`Profile for user ${user.id} already contains correct repo name: ${profile.github_repo_name}`);
    }

    console.log(`Successfully ensured repo ${repoCheckResult.repoName} for user ${user.id}`);
    return { success: true, repoName: repoCheckResult.repoName };

  } catch (error: any) {
    console.error('Error during GitHub user fetch or repo ensure process:', error);
    return { success: false, error: error.message || 'An unexpected error occurred.' };
  }
} 