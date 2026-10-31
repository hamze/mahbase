"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRef } from "react";

import type { MediaAsset } from "@/lib/api/types";
import { uploadTemporaryImage } from "@/lib/api/media";
import { t } from "@/lib/i18n/fa";

type Props = {
  value: string;
  onChange: (html: string) => void;
  /** Called with each uploaded TEMPORARY asset; the product claims it as a DESCRIPTION image on save. */
  onImageUploaded: (asset: MediaAsset) => void;
  onError: (error: unknown) => void;
};

/** Rich text for the long description. Django sanitizes the HTML with an allowlist on save. */
export function RichTextEditor({ value, onChange, onImageUploaded, onError }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const editor = useEditor({
    extensions: [StarterKit, Image, Link.configure({ openOnClick: false })],
    content: value,
    immediatelyRender: false,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  const insertImage = async (file: File) => {
    try {
      const asset = await uploadTemporaryImage(file);
      onImageUploaded(asset);
      editor?.chain().focus().setImage({ src: asset.url, alt: asset.alt_text }).run();
    } catch (error) {
      onError(error);
    }
  };

  if (!editor) return null;
  return (
    <div className="editor">
      <div className="toolbar">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}>{t("editor.bold")}</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}>{t("editor.italic")}</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
          {t("editor.heading")}
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}>
          {t("editor.bulletList")}
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          {t("editor.orderedList")}
        </button>
        <button type="button" onClick={() => fileInput.current?.click()}>{t("editor.image")}</button>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) insertImage(file);
            e.target.value = "";
          }}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
