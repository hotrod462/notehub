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

// --- Placeholder functions for other operations --- 

export async function getRepoFileContent(token: string, owner: string, repo: string, path: string): Promise<string | null> {
  console.log(`Placeholder: Fetching content for ${owner}/${repo}/${path}`);
  // TODO: Implement using octokit.rest.repos.getContent
  return null; 
}

export async function commitFile(token: string, owner: string, repo: string, path: string, content: string, message: string, sha?: string): Promise<any> {
  console.log(`Placeholder: Committing to ${owner}/${repo}/${path}`);
  // TODO: Implement using octokit.rest.repos.createOrUpdateFileContents
  return null;
}

export async function getRepoTree(token: string, owner: string, repo: string, tree_sha: string = 'main'): Promise<any[]> {
    console.log(`Placeholder: Getting tree for ${owner}/${repo}/${tree_sha}`);
    // TODO: Implement using octokit.rest.git.getTree (potentially recursive)
    return [];
}

// Add other functions as needed (commits history, get file at commit, etc.) 