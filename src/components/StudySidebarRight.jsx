import React, { useState, useMemo } from 'react';
import { Trash2, X, Plus } from 'lucide-react';

export default function StudySidebarRight({
  annotations,
  customHighlighters,
  onJumpToAnnotation,
  onDeleteAnnotation,
  onCreateQuickPostit,
  onClose,
}) {
  const [filterTag, setFilterTag] = useState('all');

  const availableTags = useMemo(() => {
    const set = new Set();
    (customHighlighters || []).forEach((h) => {
      if (h.tag) set.add(h.tag);
    });
    (annotations || []).forEach((a) => {
      if (a.tag) set.add(a.tag);
    });
    return Array.from(set);
  }, [customHighlighters, annotations]);

  const filteredAnnotations = useMemo(() => {
    return (annotations || [])
      .filter((a) => {
        if (filterTag !== 'all' && a.tag !== filterTag) return false;
        return true;
      })
      .sort((a, b) => (a.page || 1) - (b.page || 1));
  }, [annotations, filterTag]);

  return (
    <aside className="w-80 shrink-0 bg-white border-l border-violet-100 flex flex-col h-full z-20">
      <div className="p-4 border-b border-violet-50 flex items-center justify-between">
        <span className="text-sm font-semibold text-zinc-800">
          Suas Anotações ({annotations.length})
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onCreateQuickPostit}
            className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Post-it</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {availableTags.length > 0 && (
        <div className="px-4 py-2.5 flex items-center gap-1.5 overflow-x-auto border-b border-violet-50">
          <button
            type="button"
            onClick={() => setFilterTag('all')}
            className={`px-2.5 py-1 rounded-xl text-xs font-medium transition whitespace-nowrap ${
              filterTag === 'all'
                ? 'bg-violet-600 text-white'
                : 'bg-[#F5F4F9] text-zinc-600 hover:bg-violet-50'
            }`}
          >
            Todas
          </button>
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => setFilterTag(filterTag === tag ? 'all' : tag)}
              className={`px-2.5 py-1 rounded-xl text-xs font-medium transition whitespace-nowrap ${
                filterTag === tag
                  ? 'bg-violet-600 text-white'
                  : 'bg-[#F5F4F9] text-zinc-600 hover:bg-violet-50'
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {filteredAnnotations.length === 0 ? (
          <div className="text-center py-12 text-xs text-zinc-400">
            Nenhuma anotação feita ainda.
          </div>
        ) : (
          filteredAnnotations.map((ann) => (
            <div
              key={ann.id}
              onClick={() => onJumpToAnnotation(ann)}
              className="p-3 rounded-2xl bg-[#F5F4F9] hover:bg-violet-50/70 cursor-pointer transition flex items-start justify-between gap-2"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    style={{ backgroundColor: ann.color || '#FDE047' }}
                    className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                  />
                  <span className="text-xs font-semibold text-violet-950 truncate">
                    {ann.tag || 'Nota'}
                  </span>
                  <span className="text-[11px] text-zinc-400">• Pág. {ann.page || 1}</span>
                </div>
                {ann.title && (
                  <p className="text-xs font-medium text-zinc-800 mb-0.5">{ann.title}</p>
                )}
                <p className="text-xs text-zinc-600 line-clamp-3">
                  {ann.text || ann.label || 'Marcação na folha'}
                </p>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteAnnotation(ann.id);
                }}
                className="p-1.5 rounded-xl text-rose-500 hover:bg-rose-100 transition shrink-0"
                title="Apagar anotação"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
