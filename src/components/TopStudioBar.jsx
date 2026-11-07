import React, { useState, useEffect } from 'react';
import {
  Upload,
  Trash2,
  ZoomIn,
  ZoomOut,
  ChevronDown,
  FileText,
  StickyNote,
  Eraser,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

export default function TopStudioBar({
  documents,
  activeDocId,
  documentData,
  currentPage,
  pageCount,
  zoom,
  annotationsCount,
  pageAnnotationsCount,
  showNotesDrawer,
  onSelectDocument,
  onDeleteDocument,
  onUploadClick,
  onChangeZoom,
  onJumpToPage,
  onOpenSearch,
  onClearPageAnnotations,
  onToggleNotesDrawer,
}) {
  const [showFilesMenu, setShowFilesMenu] = useState(false);
  const [pageDraft, setPageDraft] = useState(String(currentPage || 1));

  useEffect(() => {
    setPageDraft(String(currentPage || 1));
  }, [currentPage]);

  const commitPageDraft = () => {
    const num = parseInt(pageDraft, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= (pageCount || 1)) {
      onJumpToPage(num);
    } else {
      setPageDraft(String(currentPage || 1));
    }
  };

  return (
    <header className="h-14 bg-white border-b border-violet-100 px-4 sm:px-6 flex items-center justify-between gap-3 z-30">
      {/* Left: File Switcher + Upload + Delete PDF */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowFilesMenu((v) => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50/70 hover:bg-violet-100/70 text-violet-950 text-xs font-medium transition max-w-[200px] sm:max-w-[260px]"
          >
            <FileText className="w-4 h-4 text-violet-600 shrink-0" />
            <span className="truncate">
              {documentData?.title || 'Nenhum PDF aberto'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          </button>

          {showFilesMenu && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowFilesMenu(false)}
              />
              <div className="absolute left-0 top-full mt-1.5 w-80 bg-white rounded-2xl shadow-float border border-violet-100 py-2 z-50">
                <div className="px-3.5 py-1.5 text-[11px] font-medium text-zinc-400">
                  Arquivos salvos ({documents.length})
                </div>

                {documents.length === 0 ? (
                  <div className="px-3.5 py-4 text-xs text-zinc-400 text-center">
                    Nenhum PDF salvo no momento.
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto px-1.5 space-y-0.5">
                    {documents.map((doc) => {
                      const isCurrent = doc.id === activeDocId;
                      return (
                        <div
                          key={doc.id}
                          className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-xs transition ${
                            isCurrent
                              ? 'bg-violet-600 text-white font-medium'
                              : 'hover:bg-violet-50 text-zinc-700'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              onSelectDocument(doc.id);
                              setShowFilesMenu(false);
                            }}
                            className="flex-1 text-left truncate"
                          >
                            {doc.title}
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteDocument(doc.id);
                            }}
                            className={`p-1.5 rounded-lg transition shrink-0 ${
                              isCurrent
                                ? 'hover:bg-violet-700 text-violet-100 hover:text-white'
                                : 'hover:bg-rose-50 text-rose-500'
                            }`}
                            title="Apagar este PDF"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={onUploadClick}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium shadow-sm transition shrink-0"
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Abrir PDF</span>
        </button>

        {activeDocId && (
          <button
            type="button"
            onClick={() => onDeleteDocument(activeDocId)}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-rose-600 hover:bg-rose-50 text-xs font-medium transition shrink-0"
            title="Apagar o PDF atual do site"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Apagar PDF</span>
          </button>
        )}
      </div>

      {/* Center: Direct Go-To-Page Input + Search Button (Ctrl+L) + Zoom */}
      {activeDocId && (
        <div className="flex items-center gap-2">
          {/* Direct Page Input */}
          <div className="flex items-center gap-1 bg-[#F5F4F9] px-1.5 py-1 rounded-xl">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onJumpToPage(Math.max(1, currentPage - 1))}
              className="p-1 rounded-lg hover:bg-white text-zinc-600 disabled:opacity-30 transition"
              title="Página anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-1 text-xs text-zinc-500">
              <span className="hidden md:inline">Pág.</span>
              <input
                type="text"
                value={pageDraft}
                onChange={(e) => setPageDraft(e.target.value)}
                onBlur={commitPageDraft}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.currentTarget.blur();
                  }
                }}
                className="w-10 py-0.5 rounded-lg bg-white text-center font-semibold text-violet-900 border border-violet-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                title="Digite o número da página e aperte Enter"
              />
              <span>/ {pageCount || 1}</span>
            </div>

            <button
              type="button"
              disabled={currentPage >= (pageCount || 1)}
              onClick={() => onJumpToPage(Math.min(pageCount || 1, currentPage + 1))}
              className="p-1 rounded-lg hover:bg-white text-zinc-600 disabled:opacity-30 transition"
              title="Próxima página"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search / Filter Modal Button (Ctrl + L) */}
          <button
            type="button"
            onClick={onOpenSearch}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F4F9] hover:bg-violet-50 text-zinc-600 hover:text-violet-900 text-xs font-medium transition"
            title="Pesquisar no PDF ou ir para página (Atalho: Ctrl + L)"
          >
            <Search className="w-3.5 h-3.5 text-violet-600" />
            <span className="hidden md:inline">Buscar</span>
            <span className="hidden lg:inline text-[10px] px-1.5 py-0.5 rounded-md bg-white text-violet-700 font-semibold border border-violet-100">
              Ctrl+L
            </span>
          </button>

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 bg-[#F5F4F9] px-2 py-1 rounded-xl">
            <button
              type="button"
              onClick={() => onChangeZoom(Math.max(0.5, +(zoom - 0.15).toFixed(2)))}
              className="p-1 rounded-lg hover:bg-white text-zinc-600 transition"
              title="Diminuir zoom"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <span className="text-xs font-semibold text-violet-900 min-w-[42px] text-center">
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              onClick={() => onChangeZoom(Math.min(2.5, +(zoom + 0.15).toFixed(2)))}
              className="p-1 rounded-lg hover:bg-white text-zinc-600 transition"
              title="Aumentar zoom"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Right: Clear Page Markings & Notes Drawer Toggle */}
      <div className="flex items-center gap-2">
        {pageAnnotationsCount > 0 && (
          <button
            type="button"
            onClick={onClearPageAnnotations}
            className="flex items-center gap-1 px-2.5 py-2 rounded-xl text-zinc-500 hover:text-rose-600 hover:bg-rose-50 text-xs font-medium transition"
            title="Apagar todas as marcações desta página"
          >
            <Eraser className="w-3.5 h-3.5" />
            <span className="hidden lg:inline">Limpar página</span>
          </button>
        )}

        {activeDocId && (
          <button
            type="button"
            onClick={onToggleNotesDrawer}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition ${
              showNotesDrawer
                ? 'bg-violet-600 text-white'
                : 'bg-violet-50 text-violet-800 hover:bg-violet-100'
            }`}
          >
            <StickyNote className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Anotações</span>
            <span>({annotationsCount})</span>
          </button>
        )}
      </div>
    </header>
  );
}
