import { FileTreeSidebar } from "@/components/FileTreeSidebar";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

export default async function NotesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-screen w-full"
    >
      <ResizablePanel defaultSize={18} minSize={15} maxSize={40}>
        <div className="flex h-full items-center justify-center">
          <FileTreeSidebar />
        </div>
      </ResizablePanel>
      <ResizableHandle 
         withHandle 
         className="w-2 bg-border hover:bg-muted-foreground/50 transition-colors flex items-center justify-center"
      > 
         <div className="h-1/6 w-px bg-foreground/50"></div> 
      </ResizableHandle>
      <ResizablePanel defaultSize={82}>
        <main className="h-full overflow-y-auto">
          {children}
        </main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
} 