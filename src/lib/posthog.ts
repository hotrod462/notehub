import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null;

function getPostHogClient(): PostHog {
    if (!posthogClient) {
        console.log("[PostHog Client] Initializing new client instance...");
        const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
        if (!apiKey) {
            console.warn("[PostHog Client] WARN: API key (NEXT_PUBLIC_POSTHOG_KEY) is MISSING. Returning dummy client.");
            // Return a dummy client or throw an error depending on desired behavior
            // For now, let's return a dummy that logs warnings
             return {
                capture: (args: { distinctId: string; event: string; properties?: Record<string, unknown> }) => console.warn("PostHog capture called but client not initialized:", args),
                identify: (args: { distinctId: string; properties?: Record<string, unknown> }) => console.warn("PostHog identify called but client not initialized:", args),
                shutdown: async () => console.warn("PostHog shutdown called but client not initialized."),
                // Add other methods used if necessary, returning void or Promises
             } as unknown as PostHog; // Type assertion needed for dummy
        }

        console.log("[PostHog Client] API key FOUND. Creating real PostHog client.");
        posthogClient = new PostHog(
            apiKey,
            {
                host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.i.posthog.com',
                // Optionally disable if you don't want events sent in development
                // enabled: process.env.NODE_ENV === 'production',
                flushAt: 1, // Send events immediately
                flushInterval: 0 // Don't batch events
            }
        );
        console.log("[PostHog Client] Real PostHog server-side client instance created.");
    } else {
      console.log("[PostHog Client] Reusing existing client instance.");
    }
    return posthogClient;
}

// Export the function to get the client instance
export const posthog = getPostHogClient(); // Use export const

// Optional: Export a function to handle shutdown gracefully if needed globally
export async function shutdownPostHog() { // Use export async function
    if (posthogClient && typeof posthogClient.shutdown === 'function') {
        console.log("[PostHog Client] Attempting to shutdown client...");
        try {
            await posthogClient.shutdown();
            posthogClient = null; // Allow re-initialization if needed
            console.log("[PostHog Client] Client shutdown successful.");
        } catch (error) {
            console.error("[PostHog Client] Error during shutdown:", error);
        }
    } else {
        console.log("[PostHog Client] Shutdown called, but no active client or shutdown method found.");
    }
}

// Consider environment-specific shutdown hooks (e.g., for Vercel)
// process.on('exit', shutdownPostHog);
// process.on('SIGTERM', async () => { await shutdownPostHog(); process.exit(0); });
// process.on('SIGINT', async () => { await shutdownPostHog(); process.exit(0); });
