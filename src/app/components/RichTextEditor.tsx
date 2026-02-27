import React from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import {
    Bold,
    Italic,
    Link as LinkIcon,
    RotateCcw,
    RotateCw,
    List,
    ListOrdered
} from "lucide-react";
import { cn } from "./ui/utils";

interface RichTextEditorProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}

export function RichTextEditor({ value, onChange, placeholder, className }: RichTextEditorProps) {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: "text-blue-600 underline",
                },
            }),
        ],
        content: value,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: "focus:outline-none min-h-[150px] p-4 prose prose-sm max-w-none prose-neutral",
            },
        },
    });

    if (!editor) {
        return null;
    }

    const setLink = () => {
        const previousUrl = editor.getAttributes("link").href;
        const url = window.prompt("URL", previousUrl);

        // cancelled
        if (url === null) {
            return;
        }

        // empty
        if (url === "") {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
            return;
        }

        // update link
        editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    };

    const MenuButton = ({
        onClick,
        isActive,
        children,
        title
    }: {
        onClick: () => void;
        isActive?: boolean;
        children: React.ReactNode;
        title: string;
    }) => (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={cn(
                "p-2 hover:bg-neutral-100 transition-colors border-r border-neutral-200 last:border-r-0",
                isActive ? "text-black bg-neutral-100" : "text-neutral-400"
            )}
        >
            {children}
        </button>
    );

    return (
        <div className={cn("relative border border-neutral-300 focus-within:border-black transition-colors rounded-sm overflow-hidden", className)}>
            <div className="flex border-b border-neutral-200 bg-neutral-50 px-1">
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    isActive={editor.isActive("bold")}
                    title="Bold"
                >
                    <Bold className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    isActive={editor.isActive("italic")}
                    title="Italic"
                >
                    <Italic className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    isActive={editor.isActive("bulletList")}
                    title="Bullet List"
                >
                    <List className="w-4 h-4" />
                </MenuButton>
                <MenuButton
                    onClick={setLink}
                    isActive={editor.isActive("link")}
                    title="Link"
                >
                    <LinkIcon className="w-4 h-4" />
                </MenuButton>
                <div className="flex-grow" />
                <MenuButton onClick={() => editor.chain().focus().undo().run()} title="Undo">
                    <RotateCcw className="w-4 h-4" />
                </MenuButton>
                <MenuButton onClick={() => editor.chain().focus().redo().run()} title="Redo">
                    <RotateCw className="w-4 h-4" />
                </MenuButton>
            </div>
            <EditorContent editor={editor} />
            {editor.isEmpty && placeholder && (
                <div className="absolute top-[52px] left-4 text-neutral-400 pointer-events-none text-sm italic">
                    {placeholder}
                </div>
            )}
        </div>
    );
}
