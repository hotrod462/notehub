'use client';

import { Button } from "@/components/ui/button";
import { signInWithGithub } from "@/app/auth/actions";

export default function SignInPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height))]">
      <h1 className="text-2xl font-semibold mb-6">Sign In</h1>
      <form action={signInWithGithub}>
        <Button variant="outline" size="lg">
          Login with GitHub
        </Button>
      </form>
    </div>
  );
} 