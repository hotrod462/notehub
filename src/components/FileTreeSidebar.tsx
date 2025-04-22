'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getNoteTree, createNote, createFolder } from '@/app/actions/noteActions';
import { toast } from 'sonner';
// Import Lucide icons (install lucide-react if not already)
import { Folder, FileText, Loader2, ChevronRight, ChevronDown, FilePlus, FolderPlus, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useRouter, useParams } from 'next/navigation';

// Define types for tree structure (can be refined)
interface TreeNodeData {
  path: string;
  name: string;
  type: 'blob' | 'tree';
  children?: TreeNodeData[];
  sha?: string;
}

interface GitHubTreeItem {
    path?: string;
    mode?: string;
    type?: 'blob' | 'tree' | 'commit'; 
    sha?: string;
    size?: number;
    url?: string;
}

// Interface for our processed nested tree node
interface ProcessedTreeNode {
  path: string;
  name: string;
  type: 'blob' | 'tree';
  children: ProcessedTreeNode[];
}

// Utility function to build the nested tree
function buildNestedTree(items: GitHubTreeItem[]): ProcessedTreeNode[] {
  const tree: ProcessedTreeNode[] = [];
  const map: { [key: string]: ProcessedTreeNode } = {};

  // Initialize nodes
  items.forEach(item => {
    if (!item.path || !item.type || (item.type !== 'blob' && item.type !== 'tree')) return;

    map[item.path] = {
      path: item.path,
      name: item.path.split('/').pop() || item.path,
      type: item.type,
      children: [],
    };
  });

  // Build the hierarchy
  Object.values(map).forEach(node => {
    const parentPath = node.path.substring(0, node.path.lastIndexOf('/'));
    if (parentPath && map[parentPath] && map[parentPath].type === 'tree') {
      map[parentPath].children.push(node);
    } else {
      // Root node
      tree.push(node);
    }
  });

  // Sort children alphabetically (folders first, then files)
  const sortNodes = (nodes: ProcessedTreeNode[]) => {
      nodes.sort((a, b) => {
          if (a.type === 'tree' && b.type === 'blob') return -1;
          if (a.type === 'blob' && b.type === 'tree') return 1;
          return a.name.localeCompare(b.name);
      });
      nodes.forEach(node => {
          if (node.type === 'tree') {
              sortNodes(node.children);
          }
      });
  };
  sortNodes(tree);

  return tree;
}

// Recursive component to render tree nodes
function TreeNode({ 
  node, 
  creationContextPath, 
  setCreationContextPath
}: { 
  node: ProcessedTreeNode; 
  creationContextPath: string; 
  setCreationContextPath: (path: string) => void; 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const isDirectory = node.type === 'tree';
  const isSelectedForCreation = creationContextPath === node.path;

  const handleToggle = (e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent setting context when toggling
      if (isDirectory) {
          setIsOpen(!isOpen);
      }
  };

  // Set context when clicking the folder item itself
  const handleSetContext = () => {
      if (isDirectory) {
          setCreationContextPath(node.path);
      } else {
          // If clicking a file, set context to its parent directory
          const lastSlash = node.path.lastIndexOf('/');
          setCreationContextPath(lastSlash > -1 ? node.path.substring(0, lastSlash) : '');
      }
  };
  
  return (
    // Add onClick to the outer div to set context
    <div 
        className={`ml-4 rounded-md ${isSelectedForCreation ? 'bg-muted' : ''}`} 
        onClick={handleSetContext} // Set context on click
    >
      <div className="flex items-center space-x-1 py-1 cursor-pointer group" >
        {/* Chevron toggle needs its own click handler */}
        <div onClick={handleToggle} className="p-1 -ml-1">
          {isDirectory ? (
            isOpen ? <ChevronDown size={16} className="text-muted-foreground flex-shrink-0"/> : <ChevronRight size={16} className="text-muted-foreground flex-shrink-0" />
          ) : (
            <FileText size={16} className="ml-[16px] mr-[4px] text-muted-foreground flex-shrink-0"/> // Indent file icon
          )}
        </div>
        {isDirectory ? (
            <Folder size={16} className="text-blue-500 mr-1 flex-shrink-0"/>
        ) : null}
        
        {isDirectory ? (
          // Folder name - clicking sets context
          <span className={`text-sm group-hover:text-primary ${isSelectedForCreation ? 'font-semibold' : ''}`}>{node.name}</span>
        ) : (
          // File link - clicking sets context via outer div and navigates
          <Link href={`/notes/${node.path}`} passHref legacyBehavior>
            <a className="text-sm hover:underline group-hover:text-primary">{node.name}</a>
          </Link>
        )}
      </div>
      {/* Render children only if directory and open */}
      {isDirectory && isOpen && (
        <div>
          {node.children.length > 0 ? (
            node.children.map(child => <TreeNode 
                key={child.path} 
                node={child} 
                creationContextPath={creationContextPath} 
                setCreationContextPath={setCreationContextPath}
             />)
          ) : (
            <div className="ml-8 text-xs text-muted-foreground italic py-1">Empty folder</div>
          )}
        </div>
      )}
    </div>
  );
}

export function FileTreeSidebar() {
  const [tree, setTree] = useState<ProcessedTreeNode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creationContextPath, setCreationContextPath] = useState<string>('');
  const router = useRouter();
  const params = useParams();

  useEffect(() => {
    const slug = params.slug;
    const notePath = Array.isArray(slug) ? slug.join('/') : null;
    if (notePath) {
      const lastSlash = notePath.lastIndexOf('/');
      setCreationContextPath(lastSlash > -1 ? notePath.substring(0, lastSlash) : '');
    } else {
      setCreationContextPath('');
    }
  }, [params.slug]);

  const fetchTree = useCallback(async (showLoading = true) => {
      if (showLoading) setIsLoading(true);
      setError(null);
      try {
          const result = await getNoteTree();
          if (result.success && result.tree) {
              const nestedTree = buildNestedTree(result.tree);
              setTree(nestedTree);
          } else {
              const errorMsg = result.error || 'Failed to load file tree.';
              setError(errorMsg);
              toast.error(errorMsg);
          }
      } catch (err: any) {
          console.error("Error fetching file tree:", err);
          const errorMessage = err.message || "An unexpected error occurred.";
          setError(errorMessage);
          toast.error(`Error loading tree: ${errorMessage}`);
      } finally {
          if (showLoading) setIsLoading(false);
      }
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);
  
  const refreshTree = useCallback(() => {
     toast.info("Refreshing file tree...");
     fetchTree(false);
  }, [fetchTree]);

  const handleNewFile = async () => {
    const basePath = creationContextPath;
    const promptMessage = `Enter name for the new note file (must end with .md)${basePath ? ` in '${basePath}'` : ' at root'}:`;
    const defaultName = "new-note.md";

    const name = window.prompt(promptMessage, defaultName);

    if (!name) {
        toast.info("File creation cancelled.");
        return;
    }

    if (!name.endsWith('.md')) {
        toast.error("Invalid name. File name must end with .md");
        return;
    }
    if (name.includes('/') || name.includes('..')) {
        toast.error("Invalid name. Use only the filename, no slashes or '..'.");
        return;
    }

    const fullPath = basePath ? `${basePath}/${name}` : name;

    const creationToast = toast.loading(`Creating ${fullPath}...`);

    try {
        const result = await createNote(fullPath);

        if (result.success && result.filePath) {
            toast.success(`File ${result.filePath} created successfully!`, { id: creationToast });
            refreshTree();
            router.push(`/notes/${result.filePath}`);
        } else {
            toast.error(`Failed to create file: ${result.error}`, { id: creationToast });
        }
    } catch (error: any) {
        console.error("Error calling createNote action:", error);
        toast.error(`An unexpected error occurred: ${error.message}`, { id: creationToast });
    }

  };

  const handleNewFolder = async () => {
    const basePath = creationContextPath;
    const promptMessage = `Enter name for the new folder${basePath ? ` in '${basePath}'` : ' at root'}:`;
    const defaultName = "new-folder";

    const name = window.prompt(promptMessage, defaultName);

    if (!name) {
        toast.info("Folder creation cancelled.");
        return;
    }

    if (name.includes('/') || name.includes('..') || name.endsWith('/') || name.startsWith('/')) {
        toast.error("Invalid name. Use only the folder name, no slashes or '..'.");
        return;
    }
    
    const fullPath = basePath ? `${basePath}/${name}` : name;

    const creationToast = toast.loading(`Creating folder ${fullPath}...`);

    try {
        const result = await createFolder(fullPath);

        if (result.success && result.folderPath) {
            toast.success(`Folder ${result.folderPath} created successfully!`, { id: creationToast });
            setCreationContextPath(result.folderPath);
            refreshTree();
        } else {
            toast.error(`Failed to create folder: ${result.error}`, { id: creationToast });
        }
    } catch (error: any) {
        console.error("Error calling createFolder action:", error);
        toast.error(`An unexpected error occurred: ${error.message}`, { id: creationToast });
    }
  };

  if (isLoading) {
    return (
      <aside className="w-64 p-4 border-r">
        <div className="flex items-center space-x-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading Tree...</span>
        </div>
      </aside>
    );
  }

  if (error) {
    return (
        <aside className="w-64 p-4 border-r text-red-600">
            <p>Error loading tree:</p>
            <p className="text-sm">{error}</p>
        </aside>
    )
  }

  return (
    <aside className="w-64 p-4 border-r overflow-y-auto flex flex-col" style={{maxHeight: 'calc(100vh - 4rem)'}}>
      <div className="flex justify-between items-center mb-1">
        <h2 className="text-lg font-semibold">Notes</h2>
        <div className="flex items-center">
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setCreationContextPath('')} 
            title="Target root directory"
            className={creationContextPath === '' ? 'text-primary' : ''}
          >
             <Home className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNewFolder} title="Create new folder in selected context">
             <FolderPlus className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleNewFile} title="Create new file in selected context">
             <FilePlus className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="text-xs text-muted-foreground mb-2 truncate px-1 py-0.5 rounded bg-muted" title={`Creation context: ${creationContextPath || '/'}`}>
         Create in: {creationContextPath ? `/${creationContextPath}` : '/'}
      </div>
      <div className="flex-grow overflow-y-auto">
        {tree.length > 0 ? (
          tree.map(node => <TreeNode 
              key={node.path} 
              node={node} 
              creationContextPath={creationContextPath} 
              setCreationContextPath={setCreationContextPath}
            />)
        ) : (
          <p className="text-sm text-muted-foreground italic">No notes found.</p>
        )}
      </div>
    </aside>
  );
} 