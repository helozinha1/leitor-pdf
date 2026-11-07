import React, { useState, useRef, useEffect } from 'react';
import { GripVertical, Trash2, Plus, Minus } from 'lucide-react';
import { INK_COLORS, STAMP_TYPES } from '../constants/studyTools';

export function TextAnnotationWidget({
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
  const textareaRef = useRef(null);

  const leftPx = (annotation.x || 0.2) * pageWidth;
  const topPx = (annotation.y || 0.2) * pageHeight;
  const baseFontSize = annotation.fontSize || 15;
  const scaledFontSize = Math.max(11, Math.round(baseFontSize * zoom));

  useEffect(() => {
    if (annotation.autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [annotation.autoFocus]);

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (e) => {
      const nextX = Math.max(0.01, Math.min(0.92, (e.clientX - dragOffset.current.x) / pageWidth));
      const nextY = Math.max(0.01, Math.min(0.95, (e.clientY - dragOffset.current.y) / pageHeight));
      onUpdate(annotation.id, { x: nextX, y: nextY }, false);
    };

    const handleUp = (e) => {
      setIsDragging(false);
      const nextX = Math.max(0.01, Math.min(0.92, (e.clientX - dragOffset.current.x) / pageWidth));
      const nextY = Math.max(0.01, Math.min(0.95, (e.clientY - dragOffset.current.y) / pageHeight));
      onUpdate(annotation.id, { x: nextX, y: nextY }, true);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
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

  return (
    <div
      style={{
        left: `${leftPx}px`,
        top: `${topPx}px`,
        zIndex: isSelected || isDragging ? 46 : 28,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onSelect(annotation.id);
      }}
      className={`absolute group rounded-xl transition-all ${
        isSelected
          ? 'bg-white/95 shadow-md ring-2 ring-violet-600 p-1.5'
          : 'bg-white/60 hover:bg-white/90 p-1 border border-transparent hover:border-violet-200'
      }`}
    >
      {isSelected && (
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="absolute -top-10 left-0 flex items-center gap-1.5 bg-white text-zinc-800 border border-violet-100 px-2.5 py-1 rounded-xl shadow-float text-xs whitespace-nowrap z-50"
        >
          <div
            onMouseDown={startDrag}
            className="cursor-grab active:cursor-grabbing p-0.5 text-zinc-400 hover:text-zinc-700"
            title="Arrastar texto"
          >
            <GripVertical className="w-3.5 h-3.5" />
          </div>

          {INK_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onUpdate(annotation.id, { color: c.hex }, true)}
              style={{ backgroundColor: c.hex }}
              className={`w-3.5 h-3.5 rounded-full ${
                annotation.color === c.hex ? 'ring-2 ring-violet-600 scale-110' : ''
              }`}
            />
          ))}

          <button
            type="button"
            onClick={() =>
              onUpdate(
                annotation.id,
                { fontSize: Math.max(10, (annotation.fontSize || 15) - 2) },
                true
              )
            }
            className="p-0.5 hover:bg-violet-50 rounded"
          >
            <Minus className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() =>
              onUpdate(
                annotation.id,
                { fontSize: Math.min(32, (annotation.fontSize || 15) + 2) },
                true
              )
            }
            className="p-0.5 hover:bg-violet-50 rounded"
          >
            <Plus className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => onDelete(annotation.id)}
            className="p-1 text-rose-500 hover:bg-rose-50 rounded-lg"
            title="Apagar texto"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-start gap-1">
        <div
          onMouseDown={startDrag}
          className="opacity-40 group-hover:opacity-80 cursor-grab active:cursor-grabbing pt-0.5 text-zinc-400"
          title="Arrastar"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <textarea
          ref={textareaRef}
          value={annotation.text || ''}
          onChange={(e) => onUpdate(annotation.id, { text: e.target.value }, true)}
          onBlur={(e) =>
            onUpdate(annotation.id, { text: e.target.value, autoFocus: false }, true)
          }
          placeholder="Digite aqui..."
          rows={Math.max(1, (annotation.text || '').split('\n').length)}
          style={{
            color: annotation.color || '#6D28D9',
            fontSize: `${scaledFontSize}px`,
            minWidth: `${Math.max(130, Math.round(150 * zoom))}px`,
          }}
          className="bg-transparent font-sans font-medium leading-snug resize focus:outline-none placeholder:text-zinc-400"
        />
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(annotation.id);
          }}
          className="opacity-0 group-hover:opacity-100 p-1 text-rose-500 hover:bg-rose-50 rounded-lg transition"
          title="Apagar texto"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

export function StampAnnotationWidget({
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

  const stampDef =
    STAMP_TYPES.find((s) => s.id === annotation.stampType) || STAMP_TYPES[0];

  const leftPx = (annotation.x || 0.1) * pageWidth;
  const topPx = (annotation.y || 0.1) * pageHeight;

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e) => {
      const nextX = Math.max(0.01, Math.min(0.95, (e.clientX - dragOffset.current.x) / pageWidth));
      const nextY = Math.max(0.01, Math.min(0.95, (e.clientY - dragOffset.current.y) / pageHeight));
      onUpdate(annotation.id, { x: nextX, y: nextY }, false);
    };
    const handleUp = (e) => {
      setIsDragging(false);
      const nextX = Math.max(0.01, Math.min(0.95, (e.clientX - dragOffset.current.x) / pageWidth));
      const nextY = Math.max(0.01, Math.min(0.95, (e.clientY - dragOffset.current.y) / pageHeight));
      onUpdate(annotation.id, { x: nextX, y: nextY }, true);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, pageWidth, pageHeight, annotation.id, onUpdate]);

  return (
    <div
      style={{
        left: `${leftPx}px`,
        top: `${topPx}px`,
        zIndex: isSelected ? 45 : 26,
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
        onSelect(annotation.id);
        dragOffset.current = { x: e.clientX - leftPx, y: e.clientY - topPx };
        setIsDragging(true);
      }}
      onClick={(e) => e.stopPropagation()}
      className="absolute cursor-grab active:cursor-grabbing select-none group"
    >
      <div
        style={{
          backgroundColor: stampDef.bg,
          borderColor: stampDef.color,
          color: stampDef.color,
          transform: `scale(${Math.max(0.85, Math.min(1.35, zoom))})`,
          transformOrigin: 'top left',
        }}
        className="flex items-center gap-1 px-2.5 py-0.5 rounded-full border font-semibold text-xs shadow-sm"
      >
        <span>{stampDef.symbol}</span>
        <span>{annotation.label || stampDef.label}</span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(annotation.id);
          }}
          className="ml-1 text-rose-600 hover:text-rose-800"
          title="Apagar"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
