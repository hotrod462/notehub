import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Button } from "@/components/ui/button";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { signInWithGithub, signOut } from "@/app/auth/actions";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NoteHub",
  description: "Your notes, versioned with GitHub.",
};

async function AppHeader() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value, 
                 set: (name, value, options) => cookieStore.set({ name, value, ...options }),
                 remove: (name, options) => cookieStore.delete({ name, ...options }) } }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex">
          <a href="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">
              NoteHub
            </span>
          </a>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          {isLoggedIn ? (
            <>
              <p className="text-sm mr-2">{user.email}</p>
              <form action={signOut}>
                <Button variant="ghost" size="sm">Logout</Button>
              </form>
            </>
          ) : (
            <form action={signInWithGithub}>
              <Button variant="outline" size="sm">Login with GitHub</Button>
            </form>
          )}
        </div>
      </div>
    </header>
  );
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased flex flex-col min-h-screen`}
      >
        {/* @ts-expect-error Server Component */}
        <AppHeader />
        <main className="flex-1 container py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
