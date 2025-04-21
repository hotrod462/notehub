import { Octokit } from "@octokit/rest"; // Using Octokit for easier API interaction

// Initialize Octokit without auth initially, token will be provided per request
// const octokit = new Octokit(); 
// Using Octokit requires installation: npm install @octokit/rest

/**
 * Fetches the authenticated user's GitHub profile information.
 * Requires the user's decrypted GitHub access token.
 */
export async function getGithubUser(token: string): Promise<any> { // Replace 'any' with a specific type later
  if (!token) {
    throw new Error("GitHub token is required.");
  }
  
  // Temporarily create Octokit instance with the provided token for this request
  const octokit = new Octokit({ auth: token });

  try {
    const { data: user } = await octokit.rest.users.getAuthenticated();
    console.log("Fetched GitHub user:", user.login);
    return user;
  } catch (error) {
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
  } catch (error: any) {
    if (error.status === 404) {
      return false; // Repository does not exist
    }
    console.error(`Error checking repo ${owner}/${repo}:`, error);
    throw new Error(`Could not check repository existence.`);
  }
}

/**
 * Creates a new private repository for the user.
 * Requires the user's decrypted GitHub access token.
 */
export async function createGithubRepo(token: string, repoName: string): Promise<any> {
   if (!token || !repoName) {
    throw new Error("GitHub token and repo name are required.");
  }
  const octokit = new Octokit({ auth: token });
  try {
    const { data: repo } = await octokit.rest.repos.createForAuthenticatedUser({
      name: repoName,
      private: true, // Ensure the repo is private
      description: "Repository for NoteHub notes",
      auto_init: true, // Initialize with a README to avoid empty repo issues
    });
    console.log(`Created GitHub repo: ${repo.full_name}`);
    return repo;
  } catch (error) {
    console.error(`Error creating GitHub repo ${repoName}:`, error);
    throw new Error(`Could not create GitHub repository.`);
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
    console.warn(`Path ${path} in ${owner}/${repo} exists but is not a file.`);
    return undefined; 
  } catch (error: any) {
    if (error.status === 404) {
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
         console.warn(`Path resolved to a directory, not a file: ${owner}/${repo}/${path}`);
         return null; // Path is a directory
    } else {
        console.warn(`Unexpected response format for ${owner}/${repo}/${path}:`, data);
         return null; // Unexpected format or missing content
    }

  } catch (error: any) {
    if (error.status === 404) {
      console.log(`File not found: ${owner}/${repo}/${path}`);
      return null; // File doesn't exist is a valid outcome
    }
    console.error(`Error getting content for ${owner}/${repo}/${path}:`, error);
    throw new Error(`Could not get file content from GitHub.`); // Re-throw other errors
  }
}

export async function commitFile(
  token: string,
  owner: string,
  repo: string,
  path: string,
  contentBase64: string, // Expecting base64 encoded content
  message: string
): Promise<any> { // Replace 'any' with specific Octokit response type later
  if (!token || !owner || !repo || !path || !contentBase64 || !message) {
    throw new Error("Missing required parameters for commitFile.");
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
  } catch (error) {
    console.error(`Error committing file ${owner}/${repo}/${path}:`, error);
    // Consider providing more context or specific error types
    throw new Error(`Could not commit file to GitHub.`); 
  }
}

// --- Updated getRepoTree function --- 
export async function getRepoTree(token: string, owner: string, repo: string, tree_sha: string = 'main'): Promise<any[]> { // Replace any[] later
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
            !item.path.startsWith('.') 
            // TODO: Add more sophisticated filtering if needed (e.g., ignore specific folders)
        ) || []; // Handle case where data.tree might be undefined

        return filteredTree;

    } catch (error: any) {
        console.error(`Error getting tree for ${owner}/${repo}/${tree_sha}:`, error);
        // Re-throw error to be handled by the calling server action
        throw error;
    }
}

// Add other functions as needed (commits history, get file at commit, etc.) 