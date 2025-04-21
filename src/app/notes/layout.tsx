import { FileTreeSidebar } from "@/components/FileTreeSidebar";

export default async function NotesLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <FileTreeSidebar />
      <main className="flex-1 pl-4">
        {children}
      </main>
    </div>
  );
} 