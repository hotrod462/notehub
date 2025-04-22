"use client"; // Convert to Client Component

import React, { useState, useEffect } from 'react'; // Import hooks
import { FileTreeSidebar } from "@/components/FileTreeSidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

// Layout is now a Client Component
export default function NotesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Render placeholder before mount
  if (!mounted) {
     // You might want a more sophisticated skeleton layout here
     return (
        <div className="flex h-screen w-full">
            <div className="w-[18%] h-full border-r bg-muted/40"></div> 
            <div className="w-px bg-border"></div>
            <div className="flex-1 h-full"></div>
        </div>
     );
  }

  // Render the actual resizable layout once mounted
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-screen w-full"
      // autoSaveId="notes-layout-panels" // Consider adding an ID for persistence if desired
    >
      <ResizablePanel defaultSize={18} minSize={15} maxSize={40}>
        <div className="flex h-full items-center justify-center border-r overflow-hidden">
          {/* FileTreeSidebar already has its own mount guard */}
          <FileTreeSidebar /> 
        </div>
      </ResizablePanel>
      <ResizableHandle 
         withHandle 
         // Removed potentially problematic custom classes for now, can be re-added if needed
         // className="w-2 bg-transparent hover:bg-muted-foreground/20 active:bg-muted-foreground/40 transition-colors flex items-center justify-center relative"
      >
         {/* Removed inner div as well, relying on default handle styling */}
         {/* <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2"></div> */}
      </ResizableHandle>
      <ResizablePanel defaultSize={82}>
        <main className="h-full overflow-y-auto">
          {children}
        </main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
} 