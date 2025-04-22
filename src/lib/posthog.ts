import { PostHog } from 'posthog-node'

let posthogClient: PostHog | null = null;

function getPostHogClient(): PostHog {
    if (!posthogClient) {
        const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
        if (!apiKey) {
            console.warn("PostHog API key (NEXT_PUBLIC_POSTHOG_KEY) is not configured. Server-side events will not be sent.");
            // Return a dummy client or throw an error depending on desired behavior
            // For now, let's return a dummy that logs warnings
             return {
                capture: (args: { distinctId: string; event: string; properties?: Record<string, unknown> }) => console.warn("PostHog capture called but client not initialized:", args),
                identify: (args: { distinctId: string; properties?: Record<string, unknown> }) => console.warn("PostHog identify called but client not initialized:", args),
                shutdown: async () => console.warn("PostHog shutdown called but client not initialized."),
                // Add other methods used if necessary, returning void or Promises
             } as unknown as PostHog; // Type assertion needed for dummy
        }

        posthogClient = new PostHog(
            apiKey,
            {
                host: process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://us.posthog.com',
                // Optionally disable if you don't want events sent in development
                // enabled: process.env.NODE_ENV === 'production',
                flushAt: 1, // Send events immediately
                flushInterval: 0 // Don't batch events
            }
        );
        console.log("PostHog server-side client initialized.");
    }
    return posthogClient;
}

// Export the function to get the client instance
export const posthog = getPostHogClient(); // Use export const

// Optional: Export a function to handle shutdown gracefully if needed globally
export async function shutdownPostHog() { // Use export async function
    if (posthogClient && typeof posthogClient.shutdown === 'function') {
        console.log("Shutting down PostHog server-side client...");
        await posthogClient.shutdown();
        posthogClient = null; // Allow re-initialization if needed
        console.log("PostHog server-side client shut down.");
    }
}

// Consider environment-specific shutdown hooks (e.g., for Vercel)
// process.on('exit', shutdownPostHog);
// process.on('SIGTERM', async () => { await shutdownPostHog(); process.exit(0); });
// process.on('SIGINT', async () => { await shutdownPostHog(); process.exit(0); });
