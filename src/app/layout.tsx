import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from 'next/script';
import "./globals.css";
import { Button } from "@/components/ui/button";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { signInWithGithub, signOut } from "@/app/auth/actions";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "next-themes";
import { ThemeToggle } from "@/components/ThemeToggle";
import Link from 'next/link';
// import { Link } from "react-router-dom";
// import { Package2 } from "lucide-react";
// import { FileTreeSidebar } from "@/components/FileTreeSidebar";
// import { cn } from "@/lib/utils";
// import { SessionProvider } from "next-auth/react"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Drafter",
  description: "Create and manage drafts backed by GitHub, in plain markdown",
};

async function AppHeader() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            console.warn("Supabase SSR: Error setting cookie in Server Component Header", error);
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) { 
             console.warn("Supabase SSR: Error removing cookie in Server Component Header", error);
          }
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const isLoggedIn = !!user;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        <div className="mr-4 hidden md:flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <span className="hidden font-bold sm:inline-block">
              Drafter
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-2">
          <ThemeToggle />
          {isLoggedIn ? (
            <>
              <p className="text-sm mr-2">{user.email}</p>
              <form action={signOut}>
                <Button variant="ghost" size="sm">Logout</Button>
              </form>
            </>
          ) : (
            <form action={signInWithGithub}>
              <Button variant="ghost" size="sm">Login with GitHub</Button>
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
      <head>
        <Script id="markdown-it-isspace-fix" strategy="beforeInteractive">
          {`
           if (typeof window !== 'undefined' && typeof window.isSpace === 'undefined') {
             window.isSpace = function(code) {
                switch (code) {
                   case 0x09: // Tab
                   case 0x20: // Space
                   case 0x0A: // LF
                   case 0x0B: // VT
                   case 0x0C: // FF
                   case 0x0D: // CR
                     return true;
                 }
                 return false;
              };
            }
          `}
        </Script>
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} font-sans antialiased flex flex-col min-h-screen`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
        >
          <AppHeader />
          <main className="flex-1">
            {children}
          </main>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
