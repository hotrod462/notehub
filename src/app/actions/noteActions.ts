"use server";

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { decrypt } from '@/lib/encryption.server';
import { getGithubUser, commitFile, getRepoFileContent, getRepoTree } from '@/lib/githubService.server'; // Assuming commitFile exists/will exist
// Import types if necessary (e.g., for Supabase data)

interface SaveNoteResult {
    success: boolean;
    error?: string;
    // Potentially return commit SHA or other relevant data
}

// Added interface for loadNote result
interface LoadNoteResult {
    success: boolean;
    content?: string | null; // Content can be string or null if not found
    error?: string;
}

// Added interface for Tree node and result
interface TreeNode {
    path?: string;
    mode?: string;
    type?: 'blob' | 'tree' | 'commit'; // Added commit for submodules if any
    sha?: string;
    size?: number;
    url?: string;
}

interface GetTreeResult {
    success: boolean;
    tree?: TreeNode[];
    error?: string;
}

export async function saveNote(notePath: string, content: string): Promise<SaveNoteResult> {
    if (!notePath) {
        return { success: false, error: 'Note path is required.' };
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } } // Only need `get` for auth
    );

    // 1. Get User & Profile
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return { success: false, error: 'User not authenticated.' };
    }

    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('github_repo_name, github_token_encrypted')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        return { success: false, error: 'Could not fetch user profile.' };
    }
    if (!profile.github_repo_name) {
        // Ideally, ensureUserRepo should have been called before reaching here
        return { success: false, error: 'GitHub repository name not set for user.' };
    }
    if (!profile.github_token_encrypted) {
        return { success: false, error: 'Encrypted GitHub token not found.' };
    }

    // 2. Decrypt Token
    const decryptedToken = decrypt(profile.github_token_encrypted);
    if (!decryptedToken) {
        return { success: false, error: 'Failed to decrypt GitHub token.' };
    }

    try {
        // 3. Get GitHub Username
        const githubUser = await getGithubUser(decryptedToken);
        const owner = githubUser.login;
        const repo = profile.github_repo_name;

        // 4. Prepare for Commit (Get SHA if file exists - logic needed in githubService.commitFile)
        // For now, we assume commitFile handles getting SHA internally or takes it as optional param
        const commitMessage = `Update note: ${notePath}`;

        // Convert incoming HTML content to Base64
        const contentBase64 = Buffer.from(content, 'utf8').toString('base64');

        // 5. Call GitHub Service to Commit
        // The commitFile function in githubService needs full implementation
        const commitResult = await commitFile(
            decryptedToken,
            owner,
            repo,
            notePath, // The path within the repo
            contentBase64, // Pass base64 encoded HTML
            commitMessage
            // We might need to pass the file's SHA here if it's an update
        );

        // Check commitResult (assuming it returns success/failure or commit data)
        // For now, assume success if no error thrown
        console.log(`Successfully committed HTML changes to ${owner}/${repo}/${notePath}`);
        return { success: true };

    } catch (error: any) {
        console.error(`Error saving note ${notePath} to GitHub:`, error);
        return { success: false, error: error.message || 'Failed to save note to GitHub.' };
    }
}

// Added loadNote server action
export async function loadNote(notePath: string): Promise<LoadNoteResult> {
    if (!notePath) {
        return { success: false, error: 'Note path is required.' };
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } } // Only need `get` for auth
    );

    // 1. Get User & Profile
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return { success: false, error: 'User not authenticated.' };
    }

    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('github_repo_name, github_token_encrypted')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        return { success: false, error: 'Could not fetch user profile.' };
    }
    if (!profile.github_repo_name) {
        return { success: false, error: 'GitHub repository name not set for user.' };
    }
    if (!profile.github_token_encrypted) {
        return { success: false, error: 'Encrypted GitHub token not found.' };
    }

    // 2. Decrypt Token
    const decryptedToken = decrypt(profile.github_token_encrypted);
    if (!decryptedToken) {
        return { success: false, error: 'Failed to decrypt GitHub token.' };
    }

    try {
        // 3. Get GitHub Username
        const githubUser = await getGithubUser(decryptedToken);
        const owner = githubUser.login;
        const repo = profile.github_repo_name;

        // 4. Call GitHub Service to Get File Content
        // The getRepoFileContent function needs full implementation
        const fileContent = await getRepoFileContent(
            decryptedToken,
            owner,
            repo,
            notePath // The path within the repo
        );

        if (fileContent === null) {
            console.log(`Note not found on GitHub: ${owner}/${repo}/${notePath}`);
            // Return success, but indicate content is null (new note)
            return { success: true, content: null };
        } else {
            console.log(`Successfully loaded content for ${owner}/${repo}/${notePath}`);
            // NOTE: Content is expected to be HTML for now, will change later
            return { success: true, content: fileContent };
        }

    } catch (error: any) {
        console.error(`Error loading note ${notePath} from GitHub:`, error);
        return { success: false, error: error.message || 'Failed to load note from GitHub.' };
    }
}

// Added getNoteTree server action
export async function getNoteTree(): Promise<GetTreeResult> {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    // 1. Get User & Profile
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
        return { success: false, error: 'User not authenticated.' };
    }

    const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('github_repo_name, github_token_encrypted')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) { return { success: false, error: 'Could not fetch user profile.' }; }
    if (!profile.github_repo_name) { return { success: false, error: 'GitHub repository name not set.' }; }
    if (!profile.github_token_encrypted) { return { success: false, error: 'Encrypted GitHub token not found.' }; }

    // 2. Decrypt Token
    const decryptedToken = decrypt(profile.github_token_encrypted);
    if (!decryptedToken) { return { success: false, error: 'Failed to decrypt GitHub token.' }; }

    try {
        // 3. Get GitHub Username & Repo
        const githubUser = await getGithubUser(decryptedToken);
        const owner = githubUser.login;
        const repo = profile.github_repo_name;

        // 4. Call GitHub Service to Get Tree (Recursive)
        // The getRepoTree function needs full implementation
        const treeData = await getRepoTree(
            decryptedToken,
            owner,
            repo,
            'main' // Assumes default branch is main
        );

        console.log(`Successfully fetched tree for ${owner}/${repo}`);
        return { success: true, tree: treeData };

    } catch (error: any) {
        console.error(`Error fetching repository tree for ${profile.github_repo_name}:`, error);
        if (error.status === 404 || error.message?.includes('Not Found') || error.message?.includes('404')) {
             return { success: false, error: 'Repository or default branch not found. Has the first note been saved?' };
        }
        return { success: false, error: error.message || 'Failed to fetch repository tree.' };
    }
} 