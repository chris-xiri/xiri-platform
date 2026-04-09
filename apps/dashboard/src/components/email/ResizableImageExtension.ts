import TiptapImage from "@tiptap/extension-image";
import { ReactNodeViewRenderer } from "@tiptap/react";
import ResizableImageView from "./ResizableImage";

/**
 * Custom TipTap Image extension that adds:
 * - A `width` attribute for persisted sizing
 * - A React NodeView with drag handles and a preset-size toolbar
 */
const ResizableImageExtension = TiptapImage.extend({
    addAttributes() {
        return {
            ...this.parent?.(),
            width: {
                default: null,
                parseHTML: (element) => element.getAttribute("width") || element.style.width || null,
                renderHTML: (attributes) => {
                    if (!attributes.width) return {};
                    return { width: attributes.width, style: `width: ${attributes.width}` };
                },
            },
        };
    },

    addNodeView() {
        return ReactNodeViewRenderer(ResizableImageView);
    },
});

export default ResizableImageExtension;
