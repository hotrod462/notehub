'use client'; // This page needs to be a client component to use the NoteEditor

import NoteEditor from '@/components/NoteEditor';
import React, { useState, useEffect, useCallback } from 'react'; // Import useState, useEffect, useCallback
import { useParams } from 'next/navigation'; // Import useParams hook
import { saveNote, loadNote, getNoteHistory, getNoteVersion, CommitInfo } from '@/app/actions/noteActions'; // Import the server action and loadNote
import { toast } from "sonner"; // Using sonner for feedback (needs installation)
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuLabel, 
    DropdownMenuSeparator, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu"; 
import { Button } from '@/components/ui/button';
import { History, Loader2 } from 'lucide-react'; // Import History icon, Loader2

// Remove params from props, as we'll get them from the hook
// interface NotePageProps {
//   params: {
//     slug: string[];
//   };
// }

const NotePage: React.FC = () => { // No props needed here now
  const params = useParams<{ slug: string[] }>(); // Use the hook to get params
  const [initialLoadComplete, setInitialLoadComplete] = useState(false); // Track initial load
  const [latestContent, setLatestContent] = useState<string>(''); // Store latest content separately
  const [displayedContent, setDisplayedContent] = useState<string>(''); // Content shown in editor
  const [history, setHistory] = useState<CommitInfo[] | null>(null);
  const [selectedCommitSha, setSelectedCommitSha] = useState<string | null>(null); // null = latest
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isVersionLoading, setIsVersionLoading] = useState(false);

  // Use effect to load INITIAL note content on mount or path change
  useEffect(() => {
    if (!params || !params.slug) return;

    const notePath = params.slug.join('/');
    let isMounted = true;
    setInitialLoadComplete(false); // Reset load state on path change
    setSelectedCommitSha(null); // Reset to latest view on path change
    setHistory(null); // Clear old history on path change

    const fetchNoteContent = async () => {
        console.log(`Loading initial note: ${notePath}`);
        // Renamed state setter
        // setIsLoading(true);
        setDisplayedContent(''); 
        try {
            const result = await loadNote(notePath);
            if (isMounted) {
                if (result.success) {
                    const content = result.content ?? '';
                    setLatestContent(content); // Store the latest content
                    setDisplayedContent(content); // Display it initially
                    // Toast messages moved to separate handlers
                } else {
                    toast.error(`Failed to load note: ${result.error || 'Unknown error'}`);
                }
            }
        } catch (error: any) {
            console.error("Client-side error calling loadNote action:", error);
            if (isMounted) {
                toast.error("An unexpected error occurred while loading the note.");
            }
        } finally {
            if (isMounted) {
                // setIsLoading(false);
                setInitialLoadComplete(true); // Mark initial load as complete
            }
        }
    };

    fetchNoteContent();

    return () => {
        isMounted = false;
    };
  }, [params]);

  // --- History Handlers ---
  const handleFetchHistory = useCallback(async () => {
    if (!params || !params.slug) return;
    const notePath = params.slug.join('/');
    if (!notePath) return;

    setIsHistoryLoading(true);
    try {
        const result = await getNoteHistory(notePath);
        if (result.success) {
            setHistory(result.history ?? []);
            if (!result.history || result.history.length === 0) {
                toast.info("No history found for this note yet.");
            }
        } else {
            toast.error(`Failed to load history: ${result.error || 'Unknown error'}`);
            setHistory(null); // Clear history on error
        }
    } catch (error: any) {
        toast.error("An error occurred while fetching history.");
        console.error("Error fetching history:", error);
        setHistory(null);
    } finally {
        setIsHistoryLoading(false);
    }
  }, [params]);

  const handleSelectVersion = useCallback(async (commitSha: string | null) => {
    if (!params || !params.slug) return;
    const notePath = params.slug.join('/');
    if (!notePath) return;

    setSelectedCommitSha(commitSha);

    if (commitSha === null) {
        // Switch back to latest content
        setDisplayedContent(latestContent);
        toast.success("Switched to latest version.");
        return;
    }

    // Fetch specific version
    setIsVersionLoading(true);
    setDisplayedContent(''); // Clear content while loading version
    try {
        const result = await getNoteVersion(notePath, commitSha);
        if (result.success) {
            setDisplayedContent(result.content ?? '# Content not found at this version');
            toast.success(`Loaded version: ${commitSha.substring(0, 7)}`);
        } else {
            toast.error(`Failed to load version: ${result.error || 'Unknown error'}`);
            setDisplayedContent(latestContent); // Fallback to latest on error?
            setSelectedCommitSha(null);
        }
    } catch (error: any) {
        toast.error("An error occurred while loading version.");
        console.error("Error loading version:", error);
        setDisplayedContent(latestContent); // Fallback
        setSelectedCommitSha(null);
    } finally {
        setIsVersionLoading(false);
    }
  }, [params, latestContent]); // Depend on latestContent for fallback
  // --- End History Handlers ---

  if (!params || !params.slug) {
    return <div>Loading note path...</div>;
  }
  
  const slug = params.slug; 
  const notePath = slug.join('/');

  const handleSaveNote = async (content: string) => {
    console.log(`Saving note: ${notePath}`);
    // Prevent saving if viewing history
    if (selectedCommitSha !== null) {
        toast.error("Cannot save while viewing history.");
        return;
    }
    try {
      const result = await saveNote(notePath, content);
      if (result.success) {
        toast.success("Note saved successfully!");
        setLatestContent(content); // Update latest content state after successful save
        setHistory(null); // Clear cached history as it's now outdated
      } else {
        toast.error(`Failed to save: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error("Client-side error calling saveNote action:", error);
      toast.error("An unexpected error occurred while trying to save.");
    }
  };

  // Determine if editor should be read-only
  const isReadOnly = selectedCommitSha !== null;

  return (
    <div>
      <div className="flex justify-between items-center mb-4"> {/* Header container */} 
          <h1 className="text-2xl font-bold">Editing: {notePath}</h1>
          {/* History Dropdown Button */} 
          <DropdownMenu onOpenChange={(open) => open && !history && handleFetchHistory()}> {/* Fetch history when opened if not already fetched */} 
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" disabled={isHistoryLoading || !initialLoadComplete}>
                    {isHistoryLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <History className="h-4 w-4" />}
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Note History</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                    onSelect={() => handleSelectVersion(null)} 
                    disabled={selectedCommitSha === null || isVersionLoading}
                >
                    Latest Version
                </DropdownMenuItem>
                {history && history.length > 0 && <DropdownMenuSeparator />} 
                {history && history.map((commit) => (
                    <DropdownMenuItem 
                        key={commit.sha}
                        onSelect={() => handleSelectVersion(commit.sha)}
                        disabled={selectedCommitSha === commit.sha || isVersionLoading}
                    >
                        <div className="text-sm">
                           <p className="font-medium truncate" title={commit.message}>{commit.message || 'No commit message'}</p>
                           <p className="text-xs text-muted-foreground">
                               {commit.sha.substring(0, 7)} by {commit.author || 'Unknown'} on {commit.date ? new Date(commit.date).toLocaleDateString() : '-'}
                           </p>
                        </div>
                    </DropdownMenuItem>
                ))}
                {history?.length === 0 && <DropdownMenuItem disabled>No history found</DropdownMenuItem>} 
                {!history && !isHistoryLoading && <DropdownMenuItem disabled>Could not load history</DropdownMenuItem>} 
            </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Show loader only while fetching specific version */}
      {isVersionLoading ? (
         <div>Loading version...</div> // Replace with spinner later
      ) : (
        <NoteEditor 
          key={`${notePath}-${selectedCommitSha || 'latest'}`} // Force re-render on path or version change
          initialContent={displayedContent} 
          onSave={handleSaveNote} 
          readOnly={isReadOnly} // Pass readOnly state
        />
      )}
    </div>
  );
};

export default NotePage; 