"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-var(--header-height))] text-center px-4">
      <h1 className="text-4xl font-bold mb-4">
        Welcome to Drafter!
      </h1>
      <p className="text-lg text-muted-foreground mb-8">
        Your drafts, versioned with GitHub in plain markdown.
      </p>
      <Link href="/auth/signin">
        <Button size="lg">Get Started</Button>
      </Link>
    </div>
  );
}
