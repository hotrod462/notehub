# NoteHub Design Document

## Overview
NoteHub is a web application for creating, editing, and managing rich-text notes online, with Git-style version control. Each user's notes are stored in a private GitHub repository. The app features a Notion-inspired minimalist UI, file tree navigation, and is built for extensibility (e.g., payments, attachments, collaboration).

---

## Core Features
- **Rich Text Note Editing:** WYSIWYG editor with full Markdown support, minimalist Notion-like UI.
- **GitHub-Backed Storage:** Each user's notes are stored in a private GitHub repo managed by the app.
- **Version History:** View commit history for a note and see the full content at any past commit.
- **File Tree Navigation:** Collapsible sidebar displays the repo's file/folder structure for navigation.
- **Authentication:** Secure login via BetterAuth (GitHub OAuth, `repo` scope).
- **User Data Management:** User profile and app metadata in Supabase.
- **(Future) Payments:** Stripe integration for premium features.

---

## Architecture
- **Deployment:** Vercel
- **Frontend:** Next.js 15 (App Router) + React 18
- **Backend:** Next.js API Routes/Server Actions (Vercel Serverless Functions)
- **Database:** Supabase (Postgres) via `supabase-js` (no ORM)
- **Authentication:** BetterAuth (GitHub OAuth, returns access token)
- **Note Storage:** GitHub (private repo per user, Markdown files)
- **UI Components:** shadcn/ui (Tailwind CSS, lucide-react icons)
- **Editor:** TipTap (headless, Markdown, custom extensions)
- **Styling:** Tailwind CSS
- **(Future) Payments:** Stripe (API + webhooks)

---

## Key Flows
- **Authentication & User Sync:**
  1. User logs in via BetterAuth (GitHub OAuth, `repo` scope).
  2. App receives JWT and GitHub access token.
  3. API route syncs user info to Supabase, encrypts and stores GitHub token.
- **Repository Creation/Access:**
  1. On first note action, API checks/creates user's private repo on GitHub.
  2. Repo info stored in Supabase.
- **Note Editing & Saving:**
  1. User edits note in TipTap editor.
  2. On save, frontend sends content to API route.
  3. API commits content to GitHub repo as Markdown file.
- **Viewing Note History:**
  1. User opens history for a note.
  2. API fetches commit history for file from GitHub.
  3. User selects commit; API fetches file content at that commit.
- **File Tree Navigation:**
  1. Sidebar fetches repo tree from API (GitHub Get Tree endpoint).
  2. User clicks file to navigate; editor loads that note.
- **(Future) Payments:**
  1. User initiates payment; API creates Stripe Checkout session.
  2. Stripe webhooks update Supabase on payment events.

---

## Data Models
- **Supabase `users` Table:**
  - `id` (uuid, PK)
  - `betterauth_user_id` (text, unique)
  - `email` (text, unique)
  - `full_name` (text)
  - `avatar_url` (text)
  - `github_access_token_encrypted` (text)
  - `github_repo_name` (text)
  - `stripe_customer_id` (text)
  - `subscription_status` (text)
  - `created_at`, `updated_at` (timestamps)
- **GitHub Repo Structure:**
  - `/notes/` (Markdown files)
  - `/attachments/` (optional)
  - `README.md` (optional)

---

## Editor Specifics (TipTap)
- **Configuration:** Headless, React component
- **Extensions:** Document, Paragraph, Text, History, Markdown, Link, Bold, Italic, Strike, Code, CodeBlock, Heading, Lists, Blockquote, HardBreak, HorizontalRule
- **UI:** Toolbar and menus with shadcn/ui, styled with Tailwind
- **Custom Features:**
  - Browser spellcheck
  - Auto-capitalize 'i'
  - View history integration

---

## Security Considerations
- **GitHub Token Encryption:** Encrypt at rest in Supabase (e.g., `aes-256-gcm`), manage key securely in Vercel env vars.
- **API Security:** Protect API routes with BetterAuth JWT validation; ensure users can only access their own data.
- **Rate Limiting:** Apply in API routes or via Vercel.
- **Input Validation:** Validate all API inputs, especially file paths.
- **Dependencies:** Keep up to date.

---

## Future Considerations
- Attachments (images/files in repo)
- Collaboration (sharing, real-time editing)
- Branching/merging
- Public notes/publishing
- Search
- Offline support
- Tagging/organization 