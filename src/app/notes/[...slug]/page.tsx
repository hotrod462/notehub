'use client'; // This page needs to be a client component to use the NoteEditor

import NoteEditor from '@/components/NoteEditor';
import React, { useState, useEffect } from 'react'; // Import useState, useEffect
import { useParams } from 'next/navigation'; // Import useParams hook
import { saveNote, loadNote } from '@/app/actions/noteActions'; // Import the server action and loadNote
import { toast } from "sonner"; // Using sonner for feedback (needs installation)

// Remove params from props, as we'll get them from the hook
// interface NotePageProps {
//   params: {
//     slug: string[];
//   };
// }

const NotePage: React.FC = () => { // No props needed here now
  const params = useParams<{ slug: string[] }>(); // Use the hook to get params
  const [isLoading, setIsLoading] = useState(true); // Add loading state
  const [noteContent, setNoteContent] = useState<string>(''); // Renamed state variable

  // Use effect to load note content on mount
  useEffect(() => {
    if (!params || !params.slug) return; // Ensure params are available

    const notePath = params.slug.join('/');
    let isMounted = true; // Prevent state update on unmounted component

    const fetchNoteContent = async () => {
        console.log(`Loading note: ${notePath}`);
        setIsLoading(true); // Start loading
        setNoteContent(''); // Clear previous content while loading
        try {
            const result = await loadNote(notePath);
            if (isMounted) {
                if (result.success) {
                    // Use the state setter here
                    setNoteContent(result.content ?? ''); 
                    if (result.content === null) {
                         toast.info("New note created.");
                    } else {
                         toast.success("Note loaded.");
                    }
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
                setIsLoading(false);
            }
        }
    };

    fetchNoteContent();

    // Cleanup function
    return () => {
        isMounted = false;
    };
  }, [params]); // Dependency array includes params

  // Handle case where params might not be ready yet (optional but good practice)
  if (!params || !params.slug) {
    // You could return a loading state or null
    return <div>Loading note path...</div>;
  }
  
  const slug = params.slug; 
  const notePath = slug.join('/');

  // Placeholder for loading note content (Step 9)
  // const initialContent = `<p>Content for <strong>${notePath}</strong> will load here.</p>`;
  
  // Update save handler to call server action
  const handleSaveNote = async (content: string) => {
    console.log(`Saving note: ${notePath}`);
    try {
      const result = await saveNote(notePath, content);
      if (result.success) {
        toast.success("Note saved successfully!");
      } else {
        toast.error(`Failed to save: ${result.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error("Client-side error calling saveNote action:", error);
      toast.error("An unexpected error occurred while trying to save.");
    }
  };

  // Render loading state or the editor
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Editing: {notePath}</h1>
      {isLoading ? (
        <div>Loading editor...</div> // Replace with spinner later
      ) : (
        <NoteEditor 
          key={notePath} // Force re-render on path change
          initialContent={noteContent} // Pass the state variable here
          onSave={handleSaveNote}
        />
      )}
    </div>
  );
};

export default NotePage; 