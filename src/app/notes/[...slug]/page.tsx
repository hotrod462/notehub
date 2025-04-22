'use client'; // This page needs to be a client component to use the NoteEditor

import NoteEditor from '@/components/NoteEditor';
import type { NoteEditorRef } from '@/components/NoteEditor';
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Import useState, useEffect, useCallback, useRef
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
import { History, Loader2, Save } from 'lucide-react'; // Removed PanelLeft, PanelRight
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogClose, // Import DialogClose
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

// Remove params from props, as we'll get them from the hook
// interface NotePageProps {
//   params: {
//     slug: string[];
//   };
// }

const NotePage: React.FC = () => { // No props needed here now
  const params = useParams<{ slug: string[] }>(); // Use the hook to get params
  const [isCommitDialogOpen, setIsCommitDialogOpen] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const editorRef = useRef<NoteEditorRef | null>(null); // Update ref type to match the exported type
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
        } catch (error: unknown) {
            console.error("Client-side error calling loadNote action:", error);
            if (isMounted) {
                const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred while loading the note.";
                toast.error(errorMessage);
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
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "An error occurred while fetching history.";
        toast.error(errorMessage);
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
    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "An error occurred while loading version.";
        toast.error(errorMessage);
        console.error("Error loading version:", error);
        setDisplayedContent(latestContent); // Fallback
        setSelectedCommitSha(null);
    } finally {
        setIsVersionLoading(false);
    }
  }, [params, latestContent]); // Depend on latestContent for fallback
  // --- End History Handlers ---

  // --- Save Handlers ---
  const isReadOnly = selectedCommitSha !== null;

  // Wrap handlePromptSave in useCallback
  const handlePromptSave = useCallback(() => {
      // Note: We need notePath here, but it might not be defined yet
      // if params are not available initially. We'll handle this inside.
      if (!params || !params.slug) {
          toast.error("Cannot save: Note path is not available yet.");
          return;
      }
      const notePath = params.slug.join('/');

      if (isReadOnly) {
          toast.error("Cannot save while viewing history.");
          return;
      }
      if (editorRef.current?.isEmpty()) {
          toast.info("Nothing to save.");
          return;
      }

      const defaultMessage = `Update ${notePath}`;
      setCommitMessage(defaultMessage);
      setIsCommitDialogOpen(true);
  }, [isReadOnly, params, editorRef, setCommitMessage, setIsCommitDialogOpen]); // Add dependencies

  const handleConfirmSave = async () => {
      // Note: We need notePath here too.
      if (!params || !params.slug) {
          console.error("Cannot save: Note path is not available.");
          toast.error("Cannot save: Note path is not available.");
          setIsCommitDialogOpen(false);
          return;
      }
      const notePath = params.slug.join('/');

      const contentToSave = editorRef.current?.getMarkdown(); 
      if (contentToSave === undefined || contentToSave === null) {
          console.error("Could not get editor content to save.");
          toast.error("Error getting content to save.");
          setIsCommitDialogOpen(false);
          return;
      }

      if (!commitMessage.trim()) {
        toast.warning("Commit message cannot be empty.");
        return; // Keep dialog open
      }

      console.log(`Saving note: ${notePath} with message: "${commitMessage}"`);
      setIsCommitDialogOpen(false);

      try {
        // Make sure saveNote has access to notePath
        const result = await saveNote(notePath, contentToSave, commitMessage); 
        
        if (result.success) {
          toast.success("Note saved successfully!");
          setLatestContent(contentToSave); // Update latest content on successful save
          setHistory(null); // Invalidate history cache after save
          // No need to reset selectedCommitSha, saving always goes to latest
        } else {
          toast.error(`Failed to save: ${result.error || 'Unknown error'}`);
        }
      } catch (error: unknown) {
        console.error("Client-side error calling saveNote action:", error);
        const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred while trying to save.";
        toast.error(errorMessage);
      } finally {
          setCommitMessage(''); // Clear message only after attempting save
      }
  };

  // --- Keybindings ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        console.log("Ctrl+S detected");
        // Check initialLoadComplete and !isReadOnly before calling handlePromptSave
        if (initialLoadComplete && !isReadOnly) {
            handlePromptSave(); // Use the memoized callback
        } else if (!initialLoadComplete) {
             toast.info("Cannot save while the note is loading.");
        } else if (isReadOnly) {
             toast.info("Cannot save while viewing history.");
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // Dependencies: handlePromptSave callback, initialLoadComplete, isReadOnly state
  }, [handlePromptSave, initialLoadComplete, isReadOnly]); 
  // --- End Keybindings ---

  // Early return if params are not yet available
  if (!params || !params.slug) {
    // Keep this minimal, hooks must be called before this
    return <div className="p-4">Loading note path...</div>;
  }
  
  // Params are available, derive notePath
  const slug = params.slug; 
  const notePath = slug.join('/');

  return (
    <div className="p-4 flex flex-col h-full">
      <div className="flex justify-between items-center mb-4 flex-shrink-0 gap-2">
          <h1 className="text-2xl font-bold truncate mr-4" title={`Editing: ${notePath}`}>
             {notePath}
          </h1>
          <div className="flex items-center gap-2">
             <Button 
                onClick={handlePromptSave}
                disabled={isReadOnly || isVersionLoading || !initialLoadComplete}
                size="sm"
             >
                  <Save className="mr-2 h-4 w-4" /> Save
             </Button>

             <DropdownMenu onOpenChange={(open) => open && !history && handleFetchHistory()}>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="default" disabled={isHistoryLoading || !initialLoadComplete}>
                        {isHistoryLoading ? 
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 
                            <History className="mr-2 h-4 w-4" />
                        }
                        Drafts
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                   <DropdownMenuLabel>Note History (Drafts)</DropdownMenuLabel>
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
      </div>

      <div className="flex-grow overflow-hidden">
          {isVersionLoading ? (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/>
                <span className="ml-2">Loading version...</span>
            </div>
          ) : initialLoadComplete ? (
            <NoteEditor 
              ref={editorRef} 
              key={`${notePath}-${selectedCommitSha || 'latest'}`} 
              initialContent={displayedContent} 
              readOnly={isReadOnly} 
            />
          ) : (
             <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground"/>
                <span className="ml-2">Loading note...</span>
            </div>
          )}
      </div>

       <Dialog open={isCommitDialogOpen} onOpenChange={setIsCommitDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Save Changes</DialogTitle>
              <DialogDescription>
                Enter a brief message describing the changes you made. This will be the commit message.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <label htmlFor="commit-message" className="text-right">
                  Message
                </label>
                <Input
                  id="commit-message"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  className="col-span-3"
                  placeholder={`Update ${notePath}`}
                  onKeyDown={(e) => { if (e.key === 'Enter' && commitMessage.trim()) { handleConfirmSave(); } }}
                />
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                 <Button type="button" variant="outline">Cancel</Button>
              </DialogClose>
              <Button 
                 type="button"
                 onClick={handleConfirmSave} 
                 disabled={!commitMessage.trim()} // Disable if message is empty
               >
                 Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </div>
  );
};

export default NotePage; 