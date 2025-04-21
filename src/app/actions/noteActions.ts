"use server";

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { decrypt } from '@/lib/encryption.server';
import { getGithubUser, commitFile, getRepoFileContent, getRepoTree, checkRepoExists, createGithubRepo, getCommitHistoryForFile, getFileContentAtCommit } from '@/lib/githubService.server'; // Added history functions
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

interface EnsureRepoResult {
    success: boolean;
    repoName?: string;
    error?: string;
    created?: boolean; // Flag to indicate if repo was newly created
}

// --- Interfaces for History Actions ---
// Export CommitInfo interface
export interface CommitInfo { 
    sha: string;
    message?: string;
    author?: string;
    date?: string;
}

interface GetHistoryResult {
    success: boolean;
    history?: CommitInfo[];
    error?: string;
}

interface GetVersionResult {
    success: boolean;
    content?: string | null; // Content can be string or null if not found at that commit
    error?: string;
}

// --- End of History Actions ---

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

// Added ensureUserRepo server action
export async function ensureUserRepo(): Promise<EnsureRepoResult> {
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

    if (profileError) { // Note: !profile is okay if repo name is null
        return { success: false, error: 'Could not fetch user profile.' };
    }
    
    // If repo name exists in profile, assume it's okay for now. 
    // TODO: Optionally add verification step using checkRepoExists
    if (profile?.github_repo_name) {
        console.log(`User ${user.id} already has repo configured: ${profile.github_repo_name}`);
        return { success: true, repoName: profile.github_repo_name, created: false };
    }

    // Repo name not set, proceed to create/verify
    console.log(`Repo name not set for user ${user.id}. Ensuring repository exists...`);

    if (!profile?.github_token_encrypted) {
        return { success: false, error: 'Encrypted GitHub token not found. Cannot create repo.' };
    }

    // 2. Decrypt Token
    const decryptedToken = decrypt(profile.github_token_encrypted);
    if (!decryptedToken) {
        return { success: false, error: 'Failed to decrypt GitHub token.' };
    }

    try {
        // 3. Get GitHub Username & Determine Repo Name
        const githubUser = await getGithubUser(decryptedToken);
        const owner = githubUser.login;
        // Define a standard repo name format
        const repoName = `notehub-notes-${owner}`; 
        let repoExisted = false;
        let repoWasCreated = false;

        console.log(`Checking for repository: ${owner}/${repoName}`);
        repoExisted = await checkRepoExists(decryptedToken, owner, repoName);

        if (!repoExisted) {
            console.log(`Repository ${owner}/${repoName} not found. Creating...`);
            await createGithubRepo(decryptedToken, repoName);
            console.log(`Successfully created repository: ${owner}/${repoName}`);
            repoWasCreated = true;
        } else {
            console.log(`Repository ${owner}/${repoName} already exists.`);
        }

        // 4. Update Supabase Profile with Repo Name
        const { error: updateError } = await supabase
            .from('users')
            .update({ github_repo_name: repoName })
            .eq('id', user.id);

        if (updateError) {
            console.error(`Failed to update Supabase profile for user ${user.id} with repo name ${repoName}:`, updateError);
            // If we created the repo but failed to save to DB, this is problematic. 
            // Manual intervention might be needed, or add retry logic.
            return { success: false, error: `Failed to update profile after ensuring repo: ${updateError.message}` };
        }

        console.log(`Successfully ensured repo ${repoName} for user ${user.id} and updated profile.`);
        return { success: true, repoName: repoName, created: repoWasCreated };

    } catch (error: any) {
        console.error(`Error ensuring GitHub repository for user ${user.id}:`, error);
        return { success: false, error: error.message || 'An unexpected error occurred while ensuring the GitHub repository.' };
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

// --- History Server Actions ---

export async function getNoteHistory(notePath: string): Promise<GetHistoryResult> {
    if (!notePath) {
        return { success: false, error: 'Note path is required.' };
    }

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

        // 4. Call GitHub Service to Get History
        const historyData = await getCommitHistoryForFile(
            decryptedToken,
            owner,
            repo,
            notePath
        );

        console.log(`Successfully fetched history for ${owner}/${repo}/${notePath}`);
        return { success: true, history: historyData };

    } catch (error: any) {
        console.error(`Error fetching history for ${profile.github_repo_name}/${notePath}:`, error);
        // Consider more specific error handling (e.g., distinguishing 404?)
        return { success: false, error: error.message || 'Failed to fetch note history.' };
    }
}

export async function getNoteVersion(notePath: string, commitSha: string): Promise<GetVersionResult> {
    if (!notePath || !commitSha) {
        return { success: false, error: 'Note path and commit SHA are required.' };
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    // 1. Get User & Profile (Copied from getNoteHistory - consider abstracting)
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

        // 4. Call GitHub Service to Get File Content at Commit
        const fileContent = await getFileContentAtCommit(
            decryptedToken,
            owner,
            repo,
            notePath,
            commitSha
        );

        if (fileContent === null) {
            console.log(`Note not found at commit ${commitSha}: ${owner}/${repo}/${notePath}`);
            // Return success, but indicate content is null (didn't exist or was dir)
            return { success: true, content: null };
        } else {
            console.log(`Successfully loaded content for ${owner}/${repo}/${notePath} at ${commitSha}`);
            return { success: true, content: fileContent };
        }

    } catch (error: any) {
        console.error(`Error loading note version ${commitSha} for ${profile.github_repo_name}/${notePath}:`, error);
        return { success: false, error: error.message || 'Failed to load note version.' };
    }
}

// --- End of History Actions --- 