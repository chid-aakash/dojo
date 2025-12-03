import React, { useEffect, useRef, useState } from "react";
import { Editor } from "@tiptap/react";
import { Extension } from "@tiptap/core";
import Suggestion, { SuggestionOptions } from "@tiptap/suggestion";
import { createRoot, Root } from "react-dom/client";

type SlashItem = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  keywords?: string[];
  perform: (editor: Editor) => void;
};

function getDefaultSlashItems(editor: Editor): SlashItem[] {
  return [
    {
      title: "Paragraph",
      subtitle: "Normal text",
      keywords: ["text", "paragraph", "p"],
      perform: (ed) => ed.chain().focus().setParagraph().run(),
    },
    {
      title: "Heading 1",
      subtitle: "Large section title",
      keywords: ["h1", "heading", "title"],
      perform: (ed) => ed.chain().focus().toggleHeading({ level: 1 }).run(),
    },
    {
      title: "Heading 2",
      subtitle: "Medium section title",
      keywords: ["h2", "heading", "subtitle"],
      perform: (ed) => ed.chain().focus().toggleHeading({ level: 2 }).run(),
    },
    {
      title: "Heading 3",
      subtitle: "Small section title",
      keywords: ["h3", "heading"],
      perform: (ed) => ed.chain().focus().toggleHeading({ level: 3 }).run(),
    },
    {
      title: "Bullet list",
      subtitle: "Create a bulleted list",
      keywords: ["bullet", "list", "ul", "unordered", "dots"],
      perform: (ed) => ed.chain().focus().toggleBulletList().run(),
    },
    {
      title: "Numbered list",
      subtitle: "Create a numbered list",
      keywords: ["numbered", "list", "ol", "ordered", "numbers"],
      perform: (ed) => ed.chain().focus().toggleOrderedList().run(),
    },
    {
      title: "Task list",
      subtitle: "Checkbox list",
      keywords: ["todo", "task", "checkbox"],
      perform: (ed) => ed.chain().focus().toggleTaskList().run(),
    },
    {
      title: "Quote",
      subtitle: "Block quote",
      keywords: ["quote", "blockquote"],
      perform: (ed) => ed.chain().focus().toggleBlockquote().run(),
    },
    {
      title: "Code block",
      subtitle: "Multi-line code",
      keywords: ["code", "block"],
      perform: (ed) => ed.chain().focus().toggleCodeBlock().run(),
    },
  ];
}

type SlashMenuProps = {
  items: SlashItem[];
  command: (item: SlashItem) => void;
  selectedIndex: number;
  editor: Editor;
  clientRect?: DOMRect;
};

const SlashMenu: React.FC<SlashMenuProps> = ({
  items,
  command,
  selectedIndex,
  editor,
  clientRect,
}) => {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!clientRect) {
      setPosition(null);
      return;
    }
    const { top, left, height } = clientRect;
    setPosition({ top: top + height + 8, left });
  }, [clientRect]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // blur editor to close menu
        editor.commands.blur();
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [editor]);

  if (!position) return null;

  return (
    <div
      ref={containerRef}
      className="z-[100] absolute min-w-[260px] max-w-[320px] rounded-lg border border-slate-700 bg-slate-900 shadow-xl overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
      }}
    >
      <div className="max-h-80 overflow-y-auto py-1">
        {items.map((item, idx) => (
          <button
            key={item.title + idx}
            className={
              "w-full text-left px-3 py-2 hover:bg-slate-800 transition-colors " +
              (idx === selectedIndex ? "bg-slate-800" : "")
            }
            onMouseDown={(e) => {
              e.preventDefault();
              command(item);
            }}
          >
            <div className="text-sm text-slate-200">{item.title}</div>
            {item.subtitle && (
              <div className="text-[11px] text-slate-500">{item.subtitle}</div>
            )}
          </button>
        ))}
        {items.length === 0 && (
          <div className="px-3 py-2 text-sm text-slate-500">No results</div>
        )}
      </div>
    </div>
  );
};

export const SlashCommand = Extension.create<{
  suggestion: Omit<SuggestionOptions<SlashItem>, "editor">;
}>({
  name: "slash-command",

  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        render: () => {
          let container: HTMLElement | null = null;
          let root: Root | null = null;

          return {
            onStart: (props) => {
              container = document.createElement("div");
              document.body.appendChild(container);
              root = createRoot(container);
              const { editor } = props;
              const items = (props.items || []) as SlashItem[];
              const selectedIndex = props.selected;
              const rect = props.clientRect?.() ?? null;
              const command = (item: SlashItem) => {
                props.command(item);
              };
              if (root) {
                root.render(
                  React.createElement(SlashMenu, {
                    items,
                    command,
                    selectedIndex,
                    editor,
                    clientRect: rect || undefined,
                  })
                );
              }
            },
            onUpdate(props) {
              if (!container || !root) return;
              const rect = props.clientRect?.() ?? null;
              root.render(
                React.createElement(SlashMenu, {
                  items: (props.items || []) as SlashItem[],
                  command: (item: SlashItem) => props.command(item),
                  selectedIndex: props.selected,
                  editor: props.editor as Editor,
                  clientRect: rect || undefined,
                })
              );
            },
            onKeyDown(props) {
              if (props.event.key === "Escape") {
                props.event.preventDefault();
                return true;
              }
              return false;
            },
            onExit() {
              if (!container) return;
              if (root) {
                root.unmount();
                root = null;
              }
              container.remove();
              container = null;
            },
          };
        },
        items: ({ editor, query }) => {
          const all = getDefaultSlashItems(editor as Editor);
          if (!query) return all;
          return all.filter((item) => {
            const q = query.toLowerCase();
            return (
              item.title.toLowerCase().includes(q) ||
              (item.keywords || []).some((k) => k.toLowerCase().includes(q))
            );
          });
        },
        command: ({ editor, props }) => {
          const chosen = props as unknown as SlashItem | undefined;
          if (!chosen) return;
          chosen.perform(editor as Editor);
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor as unknown as Editor,
        ...this.options.suggestion,
      }),
    ];
  },
});


