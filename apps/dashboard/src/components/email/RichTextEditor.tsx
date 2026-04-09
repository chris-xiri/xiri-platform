"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import ResizableImageExtension from "./ResizableImageExtension";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useCallback, useImperativeHandle, forwardRef, useState, useRef } from "react";
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, Link as LinkIcon, Unlink, Undo2, Redo2,
    RemoveFormatting, Minus, ImageIcon, Upload, Loader2, X,
} from "lucide-react";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

// ─── Types ─────────────────────────────────────────────────────────
export interface RichTextEditorRef {
    insertVariable: (variable: string) => void;
    getHTML: () => string;
    focus: () => void;
}

interface RichTextEditorProps {
    content: string;
    onChange: (html: string) => void;
    onFocus?: () => void;
    placeholder?: string;
    className?: string;
}

// ─── Toolbar Button ────────────────────────────────────────────────
function ToolbarBtn({
    onClick,
    active,
    disabled,
    title,
    children,
}: {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className={`p-1 rounded transition-colors ${
                active
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
            } ${disabled ? "opacity-30 cursor-not-allowed" : "cursor-pointer"}`}
        >
            {children}
        </button>
    );
}

// ─── Image Upload Helper ───────────────────────────────────────────
async function uploadImageToStorage(file: File): Promise<string> {
    const fileId = `email_img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const ext = file.name?.split(".").pop() || "png";
    const storageRef = ref(storage, `email-images/${fileId}.${ext}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return getDownloadURL(storageRef);
}

// ─── Editor ────────────────────────────────────────────────────────
const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
    ({ content, onChange, onFocus, placeholder, className }, ref) => {
        const [showImagePanel, setShowImagePanel] = useState(false);
        const [imageUrl, setImageUrl] = useState("");
        const [uploading, setUploading] = useState(false);
        const [uploadError, setUploadError] = useState("");
        const imageInputRef = useRef<HTMLInputElement>(null);
        const fileInputRef = useRef<HTMLInputElement>(null);

        const editor = useEditor({
            immediatelyRender: false,
            extensions: [
                StarterKit.configure({
                    heading: false, // emails don't need headings
                }),
                Underline,
                Link.configure({
                    openOnClick: false,
                    HTMLAttributes: {
                        class: "text-primary underline",
                    },
                }),
                ResizableImageExtension.configure({
                    inline: false,
                    allowBase64: false,
                }),
                Placeholder.configure({
                    placeholder: placeholder || "Start typing...",
                }),
            ],
            content,
            editorProps: {
                attributes: {
                    class: "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[280px] px-4 py-3 text-sm leading-relaxed",
                },
                // Handle paste events for images from clipboard
                handlePaste: (view, event) => {
                    const items = event.clipboardData?.items;
                    if (!items) return false;

                    for (const item of Array.from(items)) {
                        if (item.type.startsWith("image/")) {
                            event.preventDefault();
                            const file = item.getAsFile();
                            if (file) {
                                handleFileUpload(file);
                            }
                            return true;
                        }
                    }
                    return false;
                },
                // Handle drag & drop of image files
                handleDrop: (view, event) => {
                    const files = event.dataTransfer?.files;
                    if (!files || files.length === 0) return false;

                    const file = files[0];
                    if (file.type.startsWith("image/")) {
                        event.preventDefault();
                        handleFileUpload(file);
                        return true;
                    }
                    return false;
                },
            },
            onUpdate: ({ editor }) => {
                onChange(editor.getHTML());
            },
            onFocus: () => {
                onFocus?.();
            },
        });

        // Upload a file and insert the resulting URL into the editor
        const handleFileUpload = useCallback(async (file: File) => {
            if (!editor) return;

            // Validate file type
            if (!file.type.startsWith("image/")) {
                setUploadError("Only image files are supported (PNG, JPG, GIF, WebP)");
                setShowImagePanel(true);
                return;
            }

            // Validate size (5MB max for email images)
            if (file.size > 5 * 1024 * 1024) {
                setUploadError("Image must be under 5MB");
                setShowImagePanel(true);
                return;
            }

            setUploading(true);
            setUploadError("");
            setShowImagePanel(true);

            try {
                const url = await uploadImageToStorage(file);
                editor.chain().focus().setImage({ src: url, alt: file.name || "" }).run();
                setShowImagePanel(false);
                setImageUrl("");
            } catch (err: any) {
                console.error("Image upload failed:", err);
                setUploadError("Upload failed: " + (err.message || "Unknown error"));
            } finally {
                setUploading(false);
            }
        }, [editor]);

        // Sync external content changes (e.g. when switching templates)
        useEffect(() => {
            if (editor && content !== editor.getHTML()) {
                editor.commands.setContent(content, { emitUpdate: false });
            }
        }, [content, editor]);

        // Auto-focus the URL input when panel opens
        useEffect(() => {
            if (showImagePanel && !uploading && imageInputRef.current) {
                imageInputRef.current.focus();
            }
        }, [showImagePanel, uploading]);

        // Expose methods via ref
        useImperativeHandle(ref, () => ({
            insertVariable: (variable: string) => {
                if (!editor) return;
                const token = `{{${variable}}}`;
                editor.chain().focus().insertContent(token).run();
            },
            getHTML: () => editor?.getHTML() || "",
            focus: () => editor?.commands.focus(),
        }));

        const setLink = useCallback(() => {
            if (!editor) return;
            const previousUrl = editor.getAttributes("link").href;
            const url = window.prompt("URL", previousUrl);
            if (url === null) return;
            if (url === "") {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
            } else {
                editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            }
        }, [editor]);

        // Insert image from URL
        const handleUrlInsert = useCallback(() => {
            if (!editor || !imageUrl.trim()) return;
            editor.chain().focus().setImage({ src: imageUrl.trim(), alt: "" }).run();
            setImageUrl("");
            setShowImagePanel(false);
            setUploadError("");
        }, [editor, imageUrl]);

        // Handle file selection from the file picker
        const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
            const file = e.target.files?.[0];
            if (file) {
                handleFileUpload(file);
            }
            // Reset the input so the same file can be re-selected
            if (fileInputRef.current) fileInputRef.current.value = "";
        }, [handleFileUpload]);

        if (!editor) return null;

        return (
            <div className={`mt-1 border rounded-md overflow-hidden bg-background ${className || ""}`}>
                {/* Toolbar */}
                <div className="flex items-center gap-0.5 px-2 py-1.5 border-b bg-muted/30 flex-wrap">
                    {/* Text formatting */}
                    <ToolbarBtn
                        onClick={() => editor.chain().focus().toggleBold().run()}
                        active={editor.isActive("bold")}
                        title="Bold (Ctrl+B)"
                    >
                        <Bold className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                        onClick={() => editor.chain().focus().toggleItalic().run()}
                        active={editor.isActive("italic")}
                        title="Italic (Ctrl+I)"
                    >
                        <Italic className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                        onClick={() => editor.chain().focus().toggleUnderline().run()}
                        active={editor.isActive("underline")}
                        title="Underline (Ctrl+U)"
                    >
                        <UnderlineIcon className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                        onClick={() => editor.chain().focus().toggleStrike().run()}
                        active={editor.isActive("strike")}
                        title="Strikethrough"
                    >
                        <Strikethrough className="w-3.5 h-3.5" />
                    </ToolbarBtn>

                    <div className="w-px h-4 bg-border mx-1" />

                    {/* Lists */}
                    <ToolbarBtn
                        onClick={() => editor.chain().focus().toggleBulletList().run()}
                        active={editor.isActive("bulletList")}
                        title="Bullet List"
                    >
                        <List className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                        onClick={() => editor.chain().focus().toggleOrderedList().run()}
                        active={editor.isActive("orderedList")}
                        title="Numbered List"
                    >
                        <ListOrdered className="w-3.5 h-3.5" />
                    </ToolbarBtn>

                    <div className="w-px h-4 bg-border mx-1" />

                    {/* Link */}
                    <ToolbarBtn
                        onClick={setLink}
                        active={editor.isActive("link")}
                        title="Insert Link"
                    >
                        <LinkIcon className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    {editor.isActive("link") && (
                        <ToolbarBtn
                            onClick={() => editor.chain().focus().unsetLink().run()}
                            title="Remove Link"
                        >
                            <Unlink className="w-3.5 h-3.5" />
                        </ToolbarBtn>
                    )}

                    {/* Image */}
                    <ToolbarBtn
                        onClick={() => {
                            setShowImagePanel(!showImagePanel);
                            setUploadError("");
                        }}
                        active={showImagePanel}
                        title="Insert Image"
                    >
                        <ImageIcon className="w-3.5 h-3.5" />
                    </ToolbarBtn>

                    <div className="w-px h-4 bg-border mx-1" />

                    {/* Horizontal rule */}
                    <ToolbarBtn
                        onClick={() => editor.chain().focus().setHorizontalRule().run()}
                        title="Horizontal Line"
                    >
                        <Minus className="w-3.5 h-3.5" />
                    </ToolbarBtn>

                    {/* Clear formatting */}
                    <ToolbarBtn
                        onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
                        title="Clear Formatting"
                    >
                        <RemoveFormatting className="w-3.5 h-3.5" />
                    </ToolbarBtn>

                    <div className="w-px h-4 bg-border mx-1" />

                    {/* Undo/Redo */}
                    <ToolbarBtn
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        title="Undo (Ctrl+Z)"
                    >
                        <Undo2 className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                    <ToolbarBtn
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        title="Redo (Ctrl+Y)"
                    >
                        <Redo2 className="w-3.5 h-3.5" />
                    </ToolbarBtn>
                </div>

                {/* ── Image Insert Panel ── */}
                {showImagePanel && (
                    <div className="border-b bg-muted/20 px-3 py-2.5 space-y-2">
                        {/* Uploading indicator */}
                        {uploading && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                                <span>Uploading image...</span>
                            </div>
                        )}

                        {/* Error */}
                        {uploadError && (
                            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                                <X className="w-3.5 h-3.5 shrink-0" />
                                <span>{uploadError}</span>
                            </div>
                        )}

                        {!uploading && (
                            <>
                                {/* Upload from desktop / clipboard */}
                                <div className="flex items-center gap-2">
                                    {/* Hidden file input */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        className="hidden"
                                        onChange={handleFileSelect}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded border border-dashed border-border hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors"
                                    >
                                        <Upload className="w-3.5 h-3.5" />
                                        Upload from desktop
                                    </button>
                                    <span className="text-xs text-muted-foreground/60">
                                        or paste from clipboard (Ctrl+V in editor)
                                    </span>
                                </div>

                                {/* Divider */}
                                <div className="flex items-center gap-2">
                                    <div className="flex-1 h-px bg-border" />
                                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground/50 font-medium">or paste a URL</span>
                                    <div className="flex-1 h-px bg-border" />
                                </div>

                                {/* URL input */}
                                <div className="flex items-center gap-2">
                                    <ImageIcon className="w-4 h-4 text-muted-foreground shrink-0" />
                                    <input
                                        ref={imageInputRef}
                                        type="url"
                                        value={imageUrl}
                                        onChange={(e) => setImageUrl(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                                e.preventDefault();
                                                handleUrlInsert();
                                            }
                                            if (e.key === "Escape") {
                                                setShowImagePanel(false);
                                                setImageUrl("");
                                                setUploadError("");
                                            }
                                        }}
                                        placeholder="https://example.com/image.png"
                                        className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground/60"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleUrlInsert}
                                        disabled={!imageUrl.trim()}
                                        className="text-xs font-medium px-2.5 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        Insert
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowImagePanel(false);
                                            setImageUrl("");
                                            setUploadError("");
                                        }}
                                        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Editor content */}
                <EditorContent editor={editor} />
            </div>
        );
    }
);

RichTextEditor.displayName = "RichTextEditor";
export default RichTextEditor;
