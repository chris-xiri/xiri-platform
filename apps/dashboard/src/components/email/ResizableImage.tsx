"use client";

import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { useCallback, useEffect, useRef, useState } from "react";

export default function ResizableImageView({ node, updateAttributes, selected }: NodeViewProps) {
    const imgRef = useRef<HTMLImageElement>(null);
    const [resizing, setResizing] = useState(false);
    const [startX, setStartX] = useState(0);
    const [startWidth, setStartWidth] = useState(0);
    const [showToolbar, setShowToolbar] = useState(false);

    const { src, alt, width } = node.attrs;

    // Show toolbar when image is selected (clicked)
    useEffect(() => {
        setShowToolbar(selected);
    }, [selected]);

    const startResize = useCallback((e: React.MouseEvent, direction: string) => {
        e.preventDefault();
        e.stopPropagation();

        const currentWidth = imgRef.current?.offsetWidth || 300;
        setStartX(e.clientX);
        setStartWidth(currentWidth);
        setResizing(true);

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const diff = direction.includes("right")
                ? moveEvent.clientX - e.clientX
                : e.clientX - moveEvent.clientX;
            const newWidth = Math.max(50, Math.min(currentWidth + diff, 800));
            updateAttributes({ width: `${newWidth}px` });
        };

        const handleMouseUp = () => {
            setResizing(false);
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
    }, [updateAttributes]);

    const setPresetWidth = (percent: number) => {
        updateAttributes({ width: `${percent}%` });
    };

    return (
        <NodeViewWrapper
            className="relative inline-block my-2 group"
            style={{ width: width || "auto", maxWidth: "100%" }}
        >
            {/* Image */}
            <img
                ref={imgRef}
                src={src}
                alt={alt || ""}
                draggable={false}
                style={{
                    width: "100%",
                    height: "auto",
                    borderRadius: "6px",
                    display: "block",
                    outline: selected ? "2px solid hsl(var(--primary))" : "none",
                    outlineOffset: "2px",
                    cursor: "pointer",
                }}
            />

            {/* Resize handles — visible on select */}
            {selected && (
                <>
                    {/* Top-left */}
                    <div
                        onMouseDown={(e) => startResize(e, "left")}
                        style={{
                            position: "absolute", top: -4, left: -4,
                            width: 10, height: 10,
                            backgroundColor: "hsl(var(--primary))",
                            borderRadius: 2,
                            cursor: "nw-resize",
                            zIndex: 10,
                        }}
                    />
                    {/* Top-right */}
                    <div
                        onMouseDown={(e) => startResize(e, "right")}
                        style={{
                            position: "absolute", top: -4, right: -4,
                            width: 10, height: 10,
                            backgroundColor: "hsl(var(--primary))",
                            borderRadius: 2,
                            cursor: "ne-resize",
                            zIndex: 10,
                        }}
                    />
                    {/* Bottom-left */}
                    <div
                        onMouseDown={(e) => startResize(e, "left")}
                        style={{
                            position: "absolute", bottom: -4, left: -4,
                            width: 10, height: 10,
                            backgroundColor: "hsl(var(--primary))",
                            borderRadius: 2,
                            cursor: "sw-resize",
                            zIndex: 10,
                        }}
                    />
                    {/* Bottom-right */}
                    <div
                        onMouseDown={(e) => startResize(e, "right")}
                        style={{
                            position: "absolute", bottom: -4, right: -4,
                            width: 10, height: 10,
                            backgroundColor: "hsl(var(--primary))",
                            borderRadius: 2,
                            cursor: "se-resize",
                            zIndex: 10,
                        }}
                    />
                </>
            )}

            {/* Size toolbar on select */}
            {showToolbar && (
                <div
                    style={{
                        position: "absolute",
                        bottom: -36,
                        left: "50%",
                        transform: "translateX(-50%)",
                        display: "flex",
                        gap: 2,
                        padding: "4px 6px",
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 6,
                        boxShadow: "0 4px 12px rgba(0,0,0,.12)",
                        zIndex: 20,
                        whiteSpace: "nowrap",
                    }}
                >
                    {[25, 50, 75, 100].map((pct) => (
                        <button
                            key={pct}
                            type="button"
                            onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setPresetWidth(pct);
                            }}
                            style={{
                                fontSize: 11,
                                fontWeight: 500,
                                padding: "2px 8px",
                                borderRadius: 4,
                                border: "none",
                                cursor: "pointer",
                                backgroundColor:
                                    width === `${pct}%`
                                        ? "hsl(var(--primary))"
                                        : "transparent",
                                color:
                                    width === `${pct}%`
                                        ? "hsl(var(--primary-foreground))"
                                        : "hsl(var(--muted-foreground))",
                                transition: "all 0.15s",
                            }}
                            onMouseEnter={(e) => {
                                if (width !== `${pct}%`) {
                                    (e.target as HTMLElement).style.backgroundColor = "hsl(var(--muted))";
                                }
                            }}
                            onMouseLeave={(e) => {
                                if (width !== `${pct}%`) {
                                    (e.target as HTMLElement).style.backgroundColor = "transparent";
                                }
                            }}
                        >
                            {pct}%
                        </button>
                    ))}
                </div>
            )}
        </NodeViewWrapper>
    );
}
