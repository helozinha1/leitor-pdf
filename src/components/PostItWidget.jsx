import React, { useState, useRef, useEffect } from 'react';
import { GripHorizontal, Minimize2, Trash2, StickyNote } from 'lucide-react';
import { POSTIT_COLORS } from '../constants/studyTools';

export default function PostItWidget({
  annotation,
  pageWidth,
  pageHeight,
  zoom,
  isSelected,
  onSelect,
  onUpdate,
  onDelete,
}) {
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const colorObj =
    POSTIT_COLORS.find((c) => c.hex.toLowerCase() === (annotation.color || '').toLowerCase()) ||
    POSTIT_COLORS[0];

  const leftPx = (annotation.x || 0.65) * pageWidth;
  const topPx = (annotation.y || 0.15) * pageHeight;
  const widthPx = Math.max(185, Math.min(300, (annotation.width || 0.26) * pageWidth));

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e) => {
      const nextX = (e.clientX - dragOffset.current.x) / pageWidth;
      const nextY = (e.clientY - dragOffset.current.y) / pageHeight;
      const clampedX = Math.max(0.01, Math.min(0.92, nextX));
      const clampedY = Math.max(0.01, Math.min(0.94, nextY));
      onUpdate(annotation.id, { x: clampedX, y: clampedY }, false);
    };

    const handleMouseUp = (e) => {
      setIsDragging(false);
      const nextX = (e.clientX - dragOffset.current.x) / pageWidth;
      const nextY = (e.clientY - dragOffset.current.y) / pageHeight;
      const clampedX = Math.max(0.01, Math.min(0.92, nextX));
      const clampedY = Math.max(0.01, Math.min(0.94, nextY));
      onUpdate(annotation.id, { x: clampedX, y: clampedY }, true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, pageWidth, pageHeight, annotation.id, onUpdate]);

  const startDrag = (e) => {
    e.stopPropagation();
    onSelect(annotation.id);
    dragOffset.current = {
      x: e.clientX - leftPx,
      y: e.clientY - topPx,
    };
    setIsDragging(true);
  };

  if (annotation.collapsed) {
    return (
      <div
        style={{
          left: `${leftPx}px`,
          top: `${topPx}px`,
          zIndex: isSelected ? 45 : 30,
        }}
        onClick={(e) => {
          e.stopPropagation();
          onUpdate(annotation.id, { collapsed: false }, true);
        }}
        className="absolute cursor-pointer select-none transition-transform hover:scale-105"
      >
        <div
          onMouseDown={startDrag}
          style={{
            backgroundColor: colorObj.header,
            color: colorObj.text,
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-md border border-black/10 font-medium text-xs"
        >
          <StickyNote className="w-3.5 h-3.5 shrink-0" />
          <span className="max-w-[110px] truncate">
            {annotation.title || annotation.text || 'Post-it'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        left: `${leftPx}px`,
        top: `${topPx}px`,
        width: `${widthPx}px`,
        backgroundColor: colorObj.hex,
        color: colorObj.text,
        zIndex: isSelected || isDragging ? 48 : 32,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(annotation.id);
      }}
      className={`absolute rounded-2xl shadow-md border transition-shadow ${
        isSelected
          ? 'ring-2 ring-violet-600 border-black/10'
          : 'border-black/5 hover:shadow-lg'
      }`}
    >
      {/* Header with Drag & Delete */}
      <div
        onMouseDown={startDrag}
        style={{ backgroundColor: colorObj.header }}
        className="flex items-center justify-between px-3 py-1.5 rounded-t-2xl cursor-grab active:cursor-grabbing"
      >
        <div className="flex items-center gap-1.5">
          <GripHorizontal className="w-3.5 h-3.5 opacity-50" />
          <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
            {POSTIT_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onUpdate(annotation.id, { color: c.hex }, true)}
                style={{ backgroundColor: c.header }}
                className="w-3 h-3 rounded-full border border-black/20 hover:scale-110 transition-transform"
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => onUpdate(annotation.id, { collapsed: true }, true)}
            className="p-1 rounded-lg hover:bg-black/10 transition"
            title="Minimizar Post-it"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(annotation.id)}
            className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-700 transition"
            title="Apagar Post-it"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-3">
        <textarea
          rows={3}
          value={annotation.text || ''}
          onChange={(e) => onUpdate(annotation.id, { text: e.target.value }, true)}
          placeholder="Escreva sua anotação..."
          style={{
            fontSize: `${Math.max(11.5, Math.round(12 * Math.sqrt(zoom)))}px`,
          }}
          className="w-full bg-transparent resize-y min-h-[64px] placeholder:text-black/35 focus:outline-none leading-relaxed font-sans"
        />
      </div>
    </div>
  );
}
