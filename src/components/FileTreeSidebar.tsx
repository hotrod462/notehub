'use client';

import React, { useState, useEffect } from 'react';
import { getNoteTree } from '@/app/actions/noteActions';
import { toast } from 'sonner';
// Import Lucide icons (install lucide-react if not already)
import { Folder, FileText, Loader2, ChevronRight, ChevronDown } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

// Define types for tree structure (can be refined)
interface TreeNode {
  path: string;
  name: string;
  type: 'blob' | 'tree';
  children?: TreeNode[];
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
function TreeNode({ node }: { node: ProcessedTreeNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const isDirectory = node.type === 'tree';

  const handleToggle = () => {
    if (isDirectory) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="ml-4">
      <div className="flex items-center space-x-1 py-1 cursor-pointer group" onClick={handleToggle}>
        {isDirectory ? (
          isOpen ? <ChevronDown size={16} className="text-muted-foreground"/> : <ChevronRight size={16} className="text-muted-foreground" />
        ) : (
          <FileText size={16} className="ml-[16px] mr-[4px] text-muted-foreground"/> // Indent file icon
        )}
        {isDirectory ? (
            <Folder size={16} className="text-blue-500 mr-1 flex-shrink-0"/>
        ) : null}
        
        {isDirectory ? (
          <span className="text-sm hover:underline group-hover:text-primary">{node.name}</span>
        ) : (
          <Link href={`/notes/${node.path}`} passHref legacyBehavior>
            <a className="text-sm hover:underline group-hover:text-primary">{node.name}</a>
          </Link>
        )}
      </div>
      {isDirectory && isOpen && (
        <div>
          {node.children.length > 0 ? (
            node.children.map(child => <TreeNode key={child.path} node={child} />)
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

  useEffect(() => {
    let isMounted = true;
    const fetchTree = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const result = await getNoteTree();
        if (isMounted) {
          if (result.success && result.tree) {
            console.log("Raw tree data:", result.tree);
            const nestedTree = buildNestedTree(result.tree);
            console.log("Nested tree data:", nestedTree);
            setTree(nestedTree);
            toast.success('File tree loaded.');
          } else {
            setError(result.error || 'Failed to load file tree.');
            toast.error(result.error || 'Failed to load file tree.');
          }
        }
      } catch (err: any) {
         if (isMounted) {
             console.error("Error fetching file tree:", err);
             const errorMessage = err.message || "An unexpected error occurred.";
             setError(errorMessage);
             toast.error(`Error loading tree: ${errorMessage}`);
         }
      } finally {
        if (isMounted) {
            setIsLoading(false);
        }
      }
    };

    fetchTree();

    return () => { isMounted = false; };
  }, []); // Fetch on mount

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
            {/* Optional: Add a retry button */}
        </aside>
    )
  }

  return (
    <aside className="w-64 p-4 border-r overflow-y-auto" style={{maxHeight: 'calc(100vh - 4rem)'}}>
      <h2 className="text-lg font-semibold mb-2">Notes</h2>
      <div>
        {tree.length > 0 ? (
          tree.map(node => <TreeNode key={node.path} node={node} />)
        ) : (
          <p className="text-sm text-muted-foreground italic">No notes found.</p>
        )}
      </div>
    </aside>
  );
} 