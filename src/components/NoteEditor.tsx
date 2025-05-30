'use client';

import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import Link from '@tiptap/extension-link';
import React, { useCallback, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Heading1, Heading2, Heading3, List, ListOrdered, Code, Quote, LinkIcon } from 'lucide-react';
import { Toggle } from "@/components/ui/toggle";
import Heading from '@tiptap/extension-heading';

interface NoteEditorProps {
  initialContent?: string;
  readOnly?: boolean;
}

export interface NoteEditorRef {
  getMarkdown: () => string;
  isEmpty: () => boolean;
}

const EditorToolbar = ({ editor }: { editor: Editor | null }) => {
  const toggleBold = useCallback(() => editor?.chain().focus().toggleBold().run(), [editor]);
  const toggleItalic = useCallback(() => editor?.chain().focus().toggleItalic().run(), [editor]);
  const toggleH1 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 1 }).run(), [editor]);
  const toggleH2 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 2 }).run(), [editor]);
  const toggleH3 = useCallback(() => editor?.chain().focus().toggleHeading({ level: 3 }).run(), [editor]);
  const toggleBulletList = useCallback(() => editor?.chain().focus().toggleBulletList().run(), [editor]);
  const toggleOrderedList = useCallback(() => editor?.chain().focus().toggleOrderedList().run(), [editor]);
  const toggleCodeBlock = useCallback(() => editor?.chain().focus().toggleCodeBlock().run(), [editor]);
  const toggleBlockquote = useCallback(() => editor?.chain().focus().toggleBlockquote().run(), [editor]);
  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href;
    if (previousUrl) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    const url = window.prompt('Enter URL', '');
    if (url) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
    }
  }, [editor]);

  if (!editor) {
    return null;
  }

  return (
    <div className="border rounded-md p-1 mb-2 flex items-center space-x-1 flex-wrap">
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
      <Toggle
        size="sm"
        pressed={editor.isActive('bulletList')}
        onPressedChange={toggleBulletList}
        aria-label="Toggle Bullet List"
      >
        <List className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('orderedList')}
        onPressedChange={toggleOrderedList}
        aria-label="Toggle Ordered List"
      >
        <ListOrdered className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('blockquote')}
        onPressedChange={toggleBlockquote}
        aria-label="Toggle Blockquote"
      >
        <Quote className="h-4 w-4" />
      </Toggle>
      <Toggle
        size="sm"
        pressed={editor.isActive('codeBlock')}
        onPressedChange={toggleCodeBlock}
        aria-label="Toggle Code Block"
      >
        <Code className="h-4 w-4" />
      </Toggle>
      <Button 
        variant="outline" 
        size="sm" 
        onClick={setLink}
        className={editor.isActive('link') ? "is-active" : ""}
      >
        <LinkIcon className="h-4 w-4" />
      </Button>
    </div>
  );
};

const NoteEditor = forwardRef<NoteEditorRef, NoteEditorProps>((
  { initialContent = '', readOnly = false }, 
  ref
) => {
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
      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),
    ],
    content: initialContent,
    immediatelyRender: false,
    editable: !readOnly,
    editorProps: {
      attributes: {
        class: 'prose m-5 focus:outline-none border rounded-md p-4 min-h-[300px]',
        spellcheck: "true",
      },
    },
  });

  useImperativeHandle(ref, () => ({
    getMarkdown: () => {
      if (!editor) return '';
      return editor.storage.markdown.getMarkdown();
    },
    isEmpty: () => {
       if (!editor) return true;
       return editor.isEmpty;
    }
  }));

  if (!editor) {
    return null;
  }

  return (
    <div>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
});

NoteEditor.displayName = 'NoteEditor';

export default NoteEditor; 