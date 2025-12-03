import React, { useEffect, useMemo } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import BulletList from "@tiptap/extension-bullet-list";
import OrderedList from "@tiptap/extension-ordered-list";
import ListItem from "@tiptap/extension-list-item";
import Heading from "@tiptap/extension-heading";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import History from "@tiptap/extension-history";
import { SlashCommand } from "./SlashCommand";

type DiaryRichTextEditorProps = {
  initialContentHtml: string;
  onChangeHtml: (html: string, plainText: string) => void;
  onMetrics?: (metrics: { lines: number; words: number; chars: number }) => void;
  onCursor?: (cursor: { line: number; col: number }) => void;
  className?: string;
  placeholder?: string;
};

function computeMetricsFromText(text: string) {
  const lines = text.length ? text.split(/\r?\n/) : [""];
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const chars = text.length;
  return { lines: lines.length, words, chars };
}

const DiaryRichTextEditor: React.FC<DiaryRichTextEditorProps> = ({
  initialContentHtml,
  onChangeHtml,
  onMetrics,
  onCursor,
  className,
  placeholder = "start typing...",
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: false,
        orderedList: false,
        listItem: false,
        history: false,
      }),
      History.configure({
        depth: 100,
      }),
      Heading.configure({ levels: [1, 2, 3, 4] }),
      BulletList.configure({ keepAttributes: true }),
      OrderedList.configure({ keepAttributes: true }),
      ListItem,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({
        placeholder,
      }),
      SlashCommand,
    ],
    editorProps: {
      attributes: {
        class:
          "focus:outline-none w-full h-full px-4 py-4 text-[15px] leading-8 text-slate-200",
        spellCheck: "false",
        style:
          "font-family: 'Fira Code','JetBrains Mono','SF Mono','Cascadia Code',monospace; font-feature-settings:'liga' 1, 'calt' 1;",
      },
      handleKeyDown(view, event) {
        const { state } = view;
        const { editor } = (view as any).props;
        // Tab/Shift-Tab to indent/outdent list levels
        if (event.key === "Tab") {
          const e = editor as import("@tiptap/react").Editor;
          if (event.shiftKey) {
            if (e && (e.isActive("listItem") || e.isActive("taskItem"))) {
              e.commands.liftListItem("listItem");
              return true;
            }
          } else {
            if (e && (e.isActive("listItem") || e.isActive("taskItem"))) {
              e.commands.sinkListItem("listItem");
              return true;
            }
          }
        }
        return false;
      },
    },
    content: initialContentHtml || "",
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      const text = editor.getText();
      onChangeHtml(html, text);
      if (onMetrics) {
        onMetrics(computeMetricsFromText(text));
      }
    },
    onSelectionUpdate: ({ editor }) => {
      if (!onCursor) return;
      const pos = editor.state.selection.from;
      const allText = editor.state.doc.textBetween(0, pos, "\n", "\n");
      const lines = allText.split("\n");
      const line = lines.length;
      const col = lines[lines.length - 1]?.length + 1 || 1;
      onCursor({ line, col });
    },
  });

  // Sync content when initialContentHtml changes (switching entries)
  useEffect(() => {
    if (!editor) return;

    // Always update content when prop changes (handles entry switching)
    const currentContent = editor.getHTML();
    if (currentContent !== initialContentHtml) {
      editor.commands.setContent(initialContentHtml || '', false);
    }
  }, [editor, initialContentHtml]);

  // Auto-focus editor when it mounts
  useEffect(() => {
    if (editor && !editor.isFocused) {
      // Small delay to ensure DOM is ready
      setTimeout(() => editor.commands.focus('end'), 50);
    }
  }, [editor]);

  return (
    <div className={`tiptap-editor-wrapper ${className || ''}`}>
      <EditorContent editor={editor} />
    </div>
  );
};

export default DiaryRichTextEditor;


