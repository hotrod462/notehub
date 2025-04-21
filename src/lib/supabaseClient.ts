import { createBrowserClient } from "@supabase/ssr";

// Renaming the function to avoid conflict if we later create a server client utility
export const createSupabaseBrowserClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!supabaseAnonKey) {
    throw new Error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  // No need to store the client instance globally here;
  // Components will call this function to get their own instance.
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!); // Use non-null assertion as we checked above
};

// Note: We might remove the default export or export a pre-created client
// depending on usage patterns, but exporting the function is flexible.
// For now, let's remove the old default export.
// export default supabase; 