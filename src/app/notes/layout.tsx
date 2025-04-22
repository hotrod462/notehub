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
        <div className="flex h-full items-center justify-center border-r">
          <FileTreeSidebar />
        </div>
      </ResizablePanel>
      <ResizableHandle 
         withHandle 
         className="w-2 bg-transparent hover:bg-muted-foreground/20 active:bg-muted-foreground/40 transition-colors flex items-center justify-center relative"
      > 
         <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border -translate-x-1/2"></div>
      </ResizableHandle>
      <ResizablePanel defaultSize={82}>
        <main className="h-full overflow-y-auto">
          {children}
        </main>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
} 