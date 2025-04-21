# NoteHub Implementation Plan

## Overview
This document outlines the step-by-step plan for building NoteHub, an online note-taking app with GitHub-backed version control, using Next.js 15, React 18, Supabase (including Supabase Auth), TipTap, and shadcn/ui. Each step includes implementation details and testing guidance.

---

## Step 1: Project Setup & Initial Configuration

1. **Create a new Next.js project** (with TypeScript, Tailwind, App Router):
   ```bash
   npx create-next-app@latest notehub --ts --tailwind --eslint --app --src-dir --use-npm
   cd notehub
   ```
2. **Install core dependencies:**
   ```bash
   # Install Supabase client, SSR helpers, Tiptap, and UI components
   npm install @supabase/supabase-js @supabase/ssr
   npm install @tiptap/react @tiptap/pm @tiptap/starter-kit tiptap-markdown @tiptap/extension-link
   npm install lucide-react
   ```
3. **Initialize shadcn/ui:**
   ```bash
   # Use the updated CLI command
   npx shadcn@latest init
   npx shadcn@latest add button dropdown-menu tooltip dialog input label avatar # Added avatar
   ```
4. **Configure environment variables** (`.env.local`): Supabase URL/anon key, GitHub OAuth App credentials (for Supabase Auth), encryption key.
5. **Set up Jest and React Testing Library** for unit/integration tests (Skipped for now).
6. **Test:**
   - Unit: Ensure main page renders.
   - Manual: Run dev server and verify default page loads.

---

## Step 2: Supabase Setup & User Table

1. **Create `users` table** in Supabase (via SQL Editor) with fields for Supabase Auth `id` (UUID, foreign key), email, profile info, encrypted GitHub token, repo name, Stripe info, timestamps. Link `id` to `auth.users.id`.
2. **Add Supabase URL and Anon Key** to `.env.local`. Ensure `SUPABASE_SERVICE_ROLE_KEY` is also added for server-side operations.
3. **Create Supabase client utilities** using `@supabase/ssr`:
    - `src/lib/supabase/client.ts` (for Client Components, using `createBrowserClient`)
    - `src/lib/supabase/server.ts` (for Server Components/Actions/Routes, using `createServerClient`)
    - `src/lib/supabase/middleware.ts` (for middleware, using `createMiddlewareClient`)
4. **Configure GitHub Auth Provider** in Supabase Dashboard (Settings -> Authentication -> Providers):
    - Add GitHub Client ID and Secret (obtained from GitHub OAuth App).
    - Ensure the callback URL matches `http://<your-supabase-project-ref>.supabase.co/auth/v1/callback` or the one used by your setup.
    - Add required scope: `repo`.
5. **Test:**
   - Unit: Test Supabase client utilities.
   - Integration: Test DB connection (done via temporary test in page.tsx).

---

## Step 3: Supabase Auth Integration & Basic Login

1. **Create Auth Callback Route** (`src/app/auth/callback/route.ts`) using `@supabase/ssr` `createRouteHandlerClient` to handle the code exchange and session creation after GitHub redirect.
2. **Implement Auth Middleware** (`src/middleware.ts`) using `@supabase/ssr` `createMiddlewareClient` to manage session cookies and refresh tokens across requests.
3. **Add Login/Logout buttons/components** using shadcn/ui (`Button`, potentially `DropdownMenu` with `Avatar` for logged-in state).
4. **Implement login flow:**
    - Login button calls a Server Action or client-side function that uses the Supabase client (`signInWithOAuth({ provider: 'github', options: { scopes: 'repo' } })`).
5. **Implement logout flow:**
    - Logout button calls a Server Action or client-side function that uses the Supabase client (`signOut()`).
6. **Display User State:** Show login button if logged out, show user avatar/dropdown and logout if logged in (fetch user state in layout or header component using server/client Supabase client).
7. **Test:**
   - Integration: Test login/logout flow manually or with Playwright. Verify user session is created/destroyed.

---

## Step 4: Storing GitHub Token & Initial User Sync

1. **Modify `users` Table (if needed):** Ensure `github_token_encrypted` column exists.
2. **Update RLS Policies:**
    - Allow users to select/update their own record in `public.users` based on `auth.uid() = id`.
    - Ensure service role can perform necessary operations.
3. **Create Supabase Edge Function or Trigger:**
    - **Option A (Trigger):** On insert into `auth.users` (specifically for GitHub provider), trigger a function to:
        - Get the `provider_token` (GitHub access token) from the `auth.identities` table (requires querying as service role).
        - Encrypt the token using `pgsodium`.
        - Upsert the user info (email, name, avatar, encrypted token) into `public.users`, linking via `auth.users.id`.
    - **Option B (Edge Function called from Callback):** Modify the `/auth/callback` route to securely call an Edge Function after successful sign-in. The Edge Function (running with service role) fetches the provider token, encrypts it, and upserts to `public.users`.
4. **Create encryption utility** (`src/lib/encryption.server.ts`) using Node.js `crypto` if encryption/decryption is needed outside Supabase (e.g., in server actions before calling GitHub API). Ensure `ENCRYPTION_KEY` is in `.env.local`. *Alternatively, leverage Supabase's `pgsodium` for encryption/decryption directly within SQL/triggers.*
5. **Test:**
   - Unit: Test encryption utility (if applicable). Test Supabase function/trigger logic.
   - Integration: Log in via GitHub, verify user record in `public.users` with an encrypted token.

---

## Step 5: GitHub API Wrapper Service

1. **Create `src/lib/githubService.server.ts`**. Functions will need to:
    - Accept the *decrypted* GitHub token as an argument.
    - Use the token to make authenticated calls to the GitHub API (get user, get/create repo, get file, commit, get tree, etc.).
2. **Token Handling:** Server Actions/API Routes that need to call the GitHub service will:
    - Get the current user's session using Supabase server client.
    - Retrieve the *encrypted* token from `public.users`.
    - Decrypt the token (using `pgsodium` via a Supabase function call or using the Node.js `crypto` utility).
    - Pass the decrypted token to the `githubService`.
3. **Test:**
   - Unit: Mock fetch and test each function's logic and error handling. Test token decryption logic.

---

## Step 6: Repository Management Logic

1. **Create API route** (`/api/repo/ensure`) to check/create user repo on GitHub.
2. **Use Supabase to get/store repo info and token.**
3. **Test:**
   - Unit: Test handler logic for repo existence/creation.
   - Integration: Verify repo creation on GitHub and Supabase update.

---

## Step 7: Basic Editor Component (TipTap + shadcn/ui)

1. **Create `NoteEditor.tsx`** with TipTap StarterKit.
2. **Add Save button** using shadcn/ui.
3. **Render editor on note page.**
4. **Test:**
   - Unit: Test component rendering.
   - Integration: Verify editor UI and Save button.

---

## Step 8: Saving Notes (Commit Flow)

1. **Create API route** (`/api/notes/save`) for saving notes (commit to GitHub).
2. **On Save, send note content and path to API.**
3. **Test:**
   - Unit: Test API handler for new/update scenarios.
   - Integration: Save note, verify commit on GitHub.

---

## Step 9: Loading Notes

1. **Create API route** (`/api/notes/load`) to fetch note content from GitHub.
2. **On note page load, fetch and set editor content.**
3. **Test:**
   - Unit: Test API handler.
   - Integration: Load note, verify content in editor.

---

## Step 10: File Tree Sidebar Implementation

1. **Create API route** (`/api/repo/tree`) to fetch repo tree from GitHub.
2. **Create `FileTreeSidebar.tsx`** to fetch and render tree structure using shadcn/ui and lucide-react icons.
3. **Integrate sidebar into main layout** with responsive design.
4. **On file click, navigate to note page.**
5. **Test:**
   - Unit: Test API handler and sidebar rendering logic.
   - Integration: Verify sidebar displays repo structure, navigation works.

---

## Step 11: Editor Enhancements

1. **Add Markdown support** to TipTap, update save/load logic.
2. **Build full toolbar** with shadcn/ui, wire up formatting commands.
3. **Implement auto-capitalize 'i'** and enable browser spellcheck.
4. **Style editor area with Tailwind.**
5. **Test:**
   - Unit: Test custom extensions.
   - Integration: Test formatting, spellcheck, save/load with Markdown.

---

## Step 12: View History Feature

1. **Create API routes** (`/api/notes/history`, `/api/notes/version`) for commit history and file at commit.
2. **Add History button** and modal/sidebar to display commit list and historical content.
3. **Test:**
   - Unit: Test API handlers.
   - Integration: Save multiple versions, view history, verify content.

---

## Step 13: Refinement & Error Handling

1. **Review error handling, loading states, and feedback.**
2. **Refine Supabase RLS policies.**
3. **Implement rate limiting if needed.**
4. **Add comments and perform thorough manual and E2E testing.**
5. **Test:**
   - Unit: Error scenarios.
   - E2E: Main flows (login, navigation, editing, history).

---

## Future Steps (Post MVP)
- Stripe integration for payments.
- Attachments, collaboration, branching, publishing, search, offline, tagging. 