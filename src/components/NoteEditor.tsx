'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Heading1, Heading2, Heading3 } from 'lucide-react';
import { Toggle } from "@/components/ui/toggle";
import Heading from '@tiptap/extension-heading';

interface NoteEditorProps {
  initialContent?: string;
  onSave?: (content: string) => Promise<void>;
}

const EditorToolbar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }

  const toggleBold = useCallback(() => editor.chain().focus().toggleBold().run(), [editor]);
  const toggleItalic = useCallback(() => editor.chain().focus().toggleItalic().run(), [editor]);
  const toggleH1 = useCallback(() => editor.chain().focus().toggleHeading({ level: 1 }).run(), [editor]);
  const toggleH2 = useCallback(() => editor.chain().focus().toggleHeading({ level: 2 }).run(), [editor]);
  const toggleH3 = useCallback(() => editor.chain().focus().toggleHeading({ level: 3 }).run(), [editor]);

  return (
    <div className="border rounded-md p-1 mb-2 flex items-center space-x-1">
       <Toggle
        size="sm"
        pressed={editor.isActive('bold')}
        onPressedChange={toggleBold}
        aria-label="Toggle bold"
      >
        <Bold className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('italic')}
        onPressedChange={toggleItalic}
        aria-label="Toggle italic"
      >
        <Italic className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('heading', { level: 1 })}
        onPressedChange={toggleH1}
        aria-label="Toggle H1"
      >
        <Heading1 className="h-4 w-4" />
      </Toggle>
       <Toggle
        size="sm"
        pressed={editor.isActive('heading', { level: 2 })}
        onPressedChange={toggleH2}
        aria-label="Toggle H2"
      >
        <Heading2 className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('heading', { level: 3 })}
        onPressedChange={toggleH3}
        aria-label="Toggle H3"
      >
        <Heading3 className="h-4 w-4" />
      </Toggle>
    </div>
  );
};

const NoteEditor: React.FC<NoteEditorProps> = ({ initialContent = '', onSave }) => {
  const [isSaving, setIsSaving] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      Markdown.configure({
        html: false,
        tightLists: true,
        linkify: true,
        breaks: true,
      }),
      Heading.configure({ levels: [1, 2, 3] }),
    ],
    content: initialContent,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'prose m-5 focus:outline-none border rounded-md p-4 min-h-[300px]',
      },
    },
  });

  const handleSave = async () => {
    if (!editor || !onSave) return;
    setIsSaving(true);
    const contentToSave = editor.storage.markdown.getMarkdown();
    try {
      await onSave(contentToSave);
    } catch (error) {
      console.error("Failed to save note:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!editor) {
    return null;
  }

  return (
    <div>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
      <div className="mt-4 flex justify-end">
        <Button 
          onClick={handleSave} 
          disabled={isSaving || !onSave || editor.isEmpty}
        >
          {isSaving ? 'Saving...' : 'Save Note'}
        </Button>
      </div>
    </div>
  );
};

export default NoteEditor; 