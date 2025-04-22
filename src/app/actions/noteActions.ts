"use server";

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { decrypt } from '@/lib/encryption.server';
import { getGithubUser, commitFile, getRepoFileContent, getRepoTree, checkRepoExists, createGithubRepo, getCommitHistoryForFile, getFileContentAtCommit } from '@/lib/githubService.server'; // Added history functions
import { ensureUserRepo } from './repoActions'; // Import the correct ensureUserRepo
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

// --- New Interface for CreateNote Result ---
interface CreateNoteResult {
    success: boolean;
    error?: string;
    filePath?: string; // Optionally return the path created
}

// --- New Interface for CreateFolder Result ---
interface CreateFolderResult {
    success: boolean;
    error?: string;
    folderPath?: string; // Optionally return the path created
}

export async function saveNote(
    notePath: string, 
    content: string, 
    commitMessage?: string // Add optional commit message parameter
): Promise<SaveNoteResult> { 
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

        // 4. Prepare for Commit 
        // Use provided commit message or generate a default one
        const finalCommitMessage = commitMessage?.trim() 
            ? commitMessage.trim() 
            : `Update note: ${notePath}`; // Default if none provided or empty

        // Convert content to Base64 (assuming content is raw Markdown/text now)
        const contentBase64 = Buffer.from(content, 'utf8').toString('base64');

        // 5. Call GitHub Service to Commit
        const commitResult = await commitFile(
            decryptedToken,
            owner,
            repo,
            notePath, 
            contentBase64, 
            finalCommitMessage // Pass the final commit message
            // Need to ensure commitFile correctly handles getting file SHA for updates
        );

        // Check commitResult (assuming it returns success/failure or commit data)
        // For now, assume success if no error thrown
        console.log(`Successfully committed changes to ${owner}/${repo}/${notePath} with message: "${finalCommitMessage}"`);
        return { success: true };

    } catch (error: any) {
        console.error(`Error saving note ${notePath} to GitHub:`, error);
        return { success: false, error: error.message || 'Failed to save note to GitHub.' };
    }
}

// New createNote server action
export async function createNote(filePath: string, initialContent: string = ''): Promise<CreateNoteResult> {
    if (!filePath || !filePath.endsWith('.md')) {
        return { success: false, error: 'Invalid file path. Must end with .md' };
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

        // 4. Prepare for Commit
        const commitMessage = `Create note: ${filePath}`;
        // Encode initial content (even if empty)
        const contentBase64 = Buffer.from(initialContent, 'utf8').toString('base64');

        // 5. Call GitHub Service to Commit (createOrUpdateFileContents handles creation)
        await commitFile(
            decryptedToken,
            owner,
            repo,
            filePath,
            contentBase64,
            commitMessage
        );

        console.log(`Successfully created note ${owner}/${repo}/${filePath}`);
        return { success: true, filePath };

    } catch (error: any) {
        console.error(`Error creating note ${filePath} on GitHub:`, error);
        // Check for specific errors, e.g., file already exists (though commitFile might handle it)
        if (error.message?.includes('exists')) { // Basic check, improve if needed
            return { success: false, error: `File already exists at path: ${filePath}` };
        }
        return { success: false, error: error.message || 'Failed to create note on GitHub.' };
    }
}

// New createFolder server action
export async function createFolder(folderPath: string): Promise<CreateFolderResult> {
    if (!folderPath || folderPath.startsWith('/') || folderPath.includes('..') || folderPath.endsWith('/')) {
        return { success: false, error: 'Invalid folder path. Use relative paths, no trailing slash.' };
    }

    // Construct the path for the .gitkeep file
    const gitkeepPath = `${folderPath}/.gitkeep`;

    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { cookies: { get: (name) => cookieStore.get(name)?.value } }
    );

    // 1. Get User & Profile (Copied from createNote - consider abstracting common parts)
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

        // 4. Prepare for Commit
        const commitMessage = `Create folder: ${folderPath}`;
        // Create empty content for .gitkeep
        const contentBase64 = Buffer.from('', 'utf8').toString('base64');

        // 5. Call GitHub Service to Commit the .gitkeep file
        await commitFile(
            decryptedToken,
            owner,
            repo,
            gitkeepPath, // Path to the .gitkeep file
            contentBase64,
            commitMessage
        );

        console.log(`Successfully created folder ${folderPath} (via ${gitkeepPath}) in ${owner}/${repo}`);
        return { success: true, folderPath };

    } catch (error: any) {
        console.error(`Error creating folder ${folderPath} (via ${gitkeepPath}) on GitHub:`, error);
        // Check for specific errors, e.g., file already exists
        if (error.message?.includes('exists')) { 
            return { success: false, error: `File/Folder already exists at path: ${folderPath}` };
        }
        return { success: false, error: error.message || 'Failed to create folder on GitHub.' };
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
        .select('github_repo_name, github_token_encrypted') // Select token too
        .eq('id', user.id)
        .single();

    if (profileError) { 
        return { success: false, error: 'Could not fetch user profile.' };
    }

    // 2. Ensure Repo Exists using the CORRECT imported function
    const repoResult = await ensureUserRepo(); 
    if (!repoResult.success || !repoResult.repoName) {
        return { success: false, error: repoResult.error || 'Failed to ensure user repository before fetching tree.' };
    }
    const repoName = repoResult.repoName;

    // 3. Decrypt Token (Profile should be fetched by ensureUserRepo, but let's keep token fetch here for now)
     if (!profile?.github_token_encrypted) {
        return { success: false, error: 'Encrypted GitHub token not found in profile.' };
    }
    const decryptedToken = decrypt(profile.github_token_encrypted);
    if (!decryptedToken) {
        return { success: false, error: 'Failed to decrypt GitHub token.' };
    }

    try {
        // 4. Get GitHub Username
        const githubUser = await getGithubUser(decryptedToken);
        const owner = githubUser.login;

        // 5. Call GitHub Service to get tree
        // The getRepoTree function needs full implementation
        const treeData = await getRepoTree(
            decryptedToken,
            owner,
            repoName, // Use the confirmed repo name
            // Optionally pass branch name/SHA if needed, default is likely main/master
        );

        // TODO: Process treeData into the format expected by the frontend
        console.log(`Fetched tree data for ${owner}/${repoName}`);
        return { success: true, tree: treeData };

    } catch (error: any) {
        console.error(`Error getting note tree from GitHub for user ${user.id}:`, error);
        return { success: false, error: error.message || 'Failed to get note tree from GitHub.' };
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