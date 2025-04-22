import { Octokit } from "@octokit/rest"; // Using Octokit for easier API interaction
import { Endpoints } from "@octokit/types"; // Import Octokit endpoint types

// Initialize Octokit without auth initially, token will be provided per request
// const octokit = new Octokit(); 
// Using Octokit requires installation: npm install @octokit/rest

// Define more specific types based on Octokit documentation
type GithubUserResponse = Endpoints["GET /user"]["response"]["data"];
type GithubRepoResponse = Endpoints["POST /user/repos"]["response"]["data"];
type GithubCommitResponse = Endpoints["PUT /repos/{owner}/{repo}/contents/{path}"]["response"]["data"];
type GithubTreeResponse = Endpoints["GET /repos/{owner}/{repo}/git/trees/{tree_sha}"]["response"]["data"];
type GithubCommitHistoryResponse = Endpoints["GET /repos/{owner}/{repo}/commits"]["response"]["data"];
type GithubGetContentResponse = Endpoints["GET /repos/{owner}/{repo}/contents/{path}"]["response"]["data"];

// Define CommitHistoryEntry interface here
interface CommitHistoryEntry {
    sha: string;
    message?: string;
    author?: string;
    date?: string;
}

/**
 * Fetches the authenticated user's GitHub profile information.
 * Requires the user's decrypted GitHub access token.
 */
export async function getGithubUser(token: string): Promise<GithubUserResponse> {
  if (!token) {
    throw new Error("GitHub token is required.");
  }
  
  // Temporarily create Octokit instance with the provided token for this request
  const octokit = new Octokit({ auth: token });

  try {
    const { data: user } = await octokit.rest.users.getAuthenticated();
    console.log("Fetched GitHub user:", user.login);
    return user;
  } catch (error: unknown) {
    console.error("Error fetching GitHub user:", error);
    // Consider more specific error handling or re-throwing
    throw new Error("Could not fetch GitHub user information.");
  }
}

/**
 * Checks if a repository exists for the user.
 * Requires the user's decrypted GitHub access token.
 */
export async function checkRepoExists(token: string, owner: string, repo: string): Promise<boolean> {
  if (!token || !owner || !repo) {
    throw new Error("GitHub token, owner, and repo name are required.");
  }
  const octokit = new Octokit({ auth: token });
  try {
    await octokit.rest.repos.get({ owner, repo });
    return true; // Repository exists
  } catch (error: unknown) {
    // Check if error is an object with status property
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) {
      return false; // Repository does not exist
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error checking repo ${owner}/${repo}:`, errorMessage);
    throw new Error(`Could not check repository existence: ${errorMessage}`);
  }
}

/**
 * Creates a new private repository for the user.
 * Requires the user's decrypted GitHub access token.
 */
export async function createGithubRepo(token: string, repoName: string): Promise<GithubRepoResponse> {
   if (!token || !repoName) {
    throw new Error("GitHub token and repo name are required.");
  }
  const octokit = new Octokit({ auth: token });
  try {
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      private: true, // Ensure the repo is private
      description: "Repository for Drafter notes",
      auto_init: true, // Initialize with a README to avoid empty repo issues
    });
    console.log(`Created GitHub repo: ${repo.full_name}`);
    return repo;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error creating GitHub repo ${repoName}:`, errorMessage);
    throw new Error(`Could not create GitHub repository: ${errorMessage}`);
  }
}

// Helper function to get the SHA of an existing file
async function getFileSha(octokit: Octokit, owner: string, repo: string, path: string): Promise<string | undefined> {
  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
    });
    // Ensure response is for a file and has sha
    if (!Array.isArray(data) && data.type === 'file' && data.sha) {
      return data.sha;
    }
    // Handle case where path exists but is a directory (shouldn't happen for notes ideally)
    console.warn(`Path ${path} in ${owner}/${repo} exists but is not a file or doesn't have SHA.`);
    return undefined; 
  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) {
      return undefined; // File doesn't exist, valid case for new file creation
    }
    console.error(`Error getting SHA for ${owner}/${repo}/${path}:`, error);
    throw error; // Re-throw other errors to be caught by caller
  }
}

// --- Updated getRepoFileContent function --- 
export async function getRepoFileContent(token: string, owner: string, repo: string, path: string): Promise<string | null> {
  if (!token || !owner || !repo || !path) {
    throw new Error("Missing required parameters for getRepoFileContent.");
  }
  const octokit = new Octokit({ auth: token });

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      // headers: { accept: 'application/vnd.github.raw+json' }, // Usually not needed
    });

    // Check if the response is for a file and has content
    if (!Array.isArray(data) && data.type === 'file' && typeof data.content === 'string') {
      // Content is base64 encoded, decode it
      const decodedContent = Buffer.from(data.content, 'base64').toString('utf8');
      return decodedContent;
    } else if (Array.isArray(data)) {
         console.warn(`Path resolved to a directory: ${owner}/${repo}/${path}`);
         return null; // Path is a directory
    } else {
        console.warn(`Unexpected response format or missing content for ${owner}/${repo}/${path}`);
         return null; // Unexpected format or missing content
    }

  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) {
      console.log(`File not found: ${owner}/${repo}/${path}`);
      return null; // File doesn't exist is a valid outcome
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error getting content for ${owner}/${repo}/${path}:`, errorMessage);
    throw new Error(`Could not get file content from GitHub: ${errorMessage}`); // Re-throw other errors
  }
}

export async function commitFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  contentBase64: string, // Expecting base64 encoded content
  message: string
): Promise<GithubCommitResponse> {
  // Allow empty string for contentBase64 (for creating empty files)
  if (!token || !owner || !repo || !path || contentBase64 === null || contentBase64 === undefined || !message) {
    throw new Error("Missing required parameters for commitFile (token, owner, repo, path, message are required; content can be empty string).");
  }
  const octokit = new Octokit({ auth: token });

  // Check if the file exists to get its SHA for updates
  const currentSha = await getFileSha(octokit, owner, repo, path);

  console.log(`Attempting to commit ${path} to ${owner}/${repo}. SHA: ${currentSha || 'New file'}`);

  try {
    const { data: commitData } = await octokit.rest.repos.createOrUpdateFileContents({
      owner,
      repo,
      path,
      message,
      content: contentBase64, // Content must be base64 encoded string
      sha: currentSha, // Provide SHA if updating, omit if creating
      // committer: { name: 'NoteHub Bot', email: 'bot@notehub.app' }, // Optional
      // author: { name: 'NoteHub User', email: 'user@notehub.app' }, // Optional
    });
    console.log(`Commit successful for ${path}. New SHA: ${commitData.content?.sha}`);
    return commitData;
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error committing file ${owner}/${repo}/${path}:`, errorMessage);
    // Consider providing more context or specific error types
    throw new Error(`Could not commit file to GitHub: ${errorMessage}`); 
  }
}

// --- Updated getRepoTree function --- 
export async function getRepoTree(token: string, owner: string, repo: string, tree_sha: string = 'main'): Promise<GithubTreeResponse['tree']> {
    if (!token || !owner || !repo || !tree_sha) {
        throw new Error("Missing required parameters for getRepoTree.");
    }
    const octokit = new Octokit({ auth: token });

    try {
        console.log(`Fetching tree for ${owner}/${repo}, sha: ${tree_sha}`);
        const { data } = await octokit.rest.git.getTree({
            owner,
            repo,
            tree_sha, // Branch name or commit SHA
            recursive: 'true', // Get the full nested tree; value should be string per Octokit types
        });

        if (data.truncated) {
            console.warn(`GitHub tree data for ${owner}/${repo} was truncated.`);
            // Application might need to handle this case if very large repos are expected
        }

        // Filter out non-blob/tree types if necessary (e.g., 'commit' for submodules)
        // Also filter out files at the root starting with . like .gitignore
        const filteredTree = data.tree?.filter(item => 
            (item.type === 'blob' || item.type === 'tree') && 
            item.path && 
            !item.path.startsWith('.') &&
            // Ensure we don't include the .gitkeep files used for empty folders
            !item.path.endsWith('.gitkeep') 
        ) || []; // Handle case where data.tree might be undefined

        // Assert the type after filtering to satisfy the stricter return type
        return filteredTree as { 
            path: string; 
            mode: string; 
            type: string; 
            sha: string; 
            size?: number; 
            url?: string; 
        }[];

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error getting tree for ${owner}/${repo}/${tree_sha}:`, errorMessage);
        // Re-throw error to be handled by the calling server action
        throw new Error(`Could not get repo tree: ${errorMessage}`);
    }
}

// Add other functions as needed (commits history, get file at commit, etc.) 

/**
 * Fetches the commit history for a specific file path.
 * Requires the user's decrypted GitHub access token.
 */
export async function getCommitHistoryForFile(token: string, owner: string, repo: string, path: string): Promise<CommitHistoryEntry[]> {
  if (!token || !owner || !repo || !path) {
    throw new Error("Missing required parameters for getCommitHistoryForFile.");
  }
  const octokit = new Octokit({ auth: token });

  try {
    // Fetch commits, filtering by the file path
    const { data: commits } = await octokit.rest.repos.listCommits({
      owner,
      repo,
      path,
      // You might want to add pagination parameters like per_page and page if needed
      // per_page: 30, 
    });
    console.log(`Fetched ${commits.length} commits for path: ${owner}/${repo}/${path}`);
    // Return relevant data (e.g., sha, commit message, author, date)
    // Map to a cleaner structure if desired
    return commits.map((c: GithubCommitHistoryResponse[number]) => ({
        sha: c.sha,
        message: c.commit.message,
        author: c.commit.author?.name,
        date: c.commit.author?.date,
    }));
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error fetching commit history for ${owner}/${repo}/${path}:`, errorMessage);
    // Handle 404 for path not found? The API might just return empty list.
    throw new Error(`Could not fetch commit history from GitHub: ${errorMessage}`);
  }
}

/**
 * Fetches the content of a specific file at a given commit SHA.
 * Requires the user's decrypted GitHub access token.
 */
export async function getFileContentAtCommit(token: string, owner: string, repo: string, path: string, commitSha: string): Promise<string | null> {
  if (!token || !owner || !repo || !path || !commitSha) {
    throw new Error("Missing required parameters for getFileContentAtCommit.");
  }
  const octokit = new Octokit({ auth: token });

  try {
    const { data } = await octokit.rest.repos.getContent({
      owner,
      repo,
      path,
      ref: commitSha, // Specify the commit SHA
    });

    // Check if the response is for a file and has content
    if (!Array.isArray(data) && data.type === 'file' && typeof data.content === 'string') {
      // Content is base64 encoded, decode it
      const decodedContent = Buffer.from(data.content, 'base64').toString('utf8');
      return decodedContent;
    } else {
      console.warn(`Path ${path} at commit ${commitSha} in ${owner}/${repo} did not resolve to a file with content. Type: ${Array.isArray(data) ? 'directory' : data.type}`);
      return null; // Path is a directory or unexpected format at this commit
    }

  } catch (error: unknown) {
    if (typeof error === 'object' && error !== null && 'status' in error && error.status === 404) {
      console.log(`File not found at commit ${commitSha}: ${owner}/${repo}/${path}`);
      return null; // File didn't exist at this commit
    }
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Error getting content for ${owner}/${repo}/${path} at commit ${commitSha}:`, errorMessage);
    throw new Error(`Could not get file content at commit from GitHub: ${errorMessage}`); // Re-throw other errors
  }
} 