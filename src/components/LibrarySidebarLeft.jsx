import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Bookmark,
  Trash2,
  BookOpen,
  GraduationCap,
  Layers,
  Loader2,
} from 'lucide-react';

export default function LibrarySidebarLeft({
  documents,
  activeDocId,
  currentPage,
  pageCount,
  annotations,
  bookmarkedPages,
  darkMode,
  isUploading,
  fileInputRef,
  onSelectDocument,
  onUploadFile,
  onDeleteDocument,
  onJumpToPage,
}) {
  const [uploadCategory, setUploadCategory] = useState('apostila');
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadFile(file, uploadCategory);
      e.target.value = '';
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      onUploadFile(file, uploadCategory);
    }
  };

  return (
    <aside
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
      className={`w-60 xl:w-64 shrink-0 border-r flex flex-col h-full select-none transition-colors ${
        darkMode
          ? 'bg-slate-900/70 border-slate-800 text-slate-200'
          : 'bg-white/80 border-slate-200/70 text-slate-700'
      } backdrop-blur-sm ${isDragOver ? 'ring-2 ring-sky-400 bg-sky-50/40' : ''}`}
    >
      {/* Minimal Upload Section */}
      <div className="p-3.5 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-1 mb-2.5 bg-slate-100/80 dark:bg-slate-800 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => setUploadCategory('apostila')}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-medium transition ${
              uploadCategory === 'apostila'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <BookOpen className="w-3 h-3" />
            <span>Apostila</span>
          </button>
          <button
            type="button"
            onClick={() => setUploadCategory('prova')}
            className={`flex-1 flex items-center justify-center gap-1 py-1 rounded-lg text-[11px] font-medium transition ${
              uploadCategory === 'prova'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
            }`}
          >
            <GraduationCap className="w-3 h-3" />
            <span>Prova</span>
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain"
          onChange={handleFileChange}
          className="hidden"
        />

        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef?.current?.click()}
          className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-sky-500 dark:hover:bg-sky-400 disabled:opacity-60 text-white font-medium text-xs flex items-center justify-center gap-2 transition"
        >
          {isUploading ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Salvando PDF...</span>
            </>
          ) : (
            <>
              <Upload className="w-3.5 h-3.5" />
              <span>Enviar PDF / Prova</span>
            </>
          )}
        </button>
      </div>

      {/* Saved PDFs List */}
      <div className="p-3.5 flex-1 min-h-0 flex flex-col">
        <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 mb-2 flex items-center gap-1.5">
          <FileText className="w-3.5 h-3.5" />
          <span>Salvos no site ({documents.length})</span>
        </span>

        <div className="space-y-1 overflow-y-auto pr-1 flex-1">
          {documents.map((doc) => {
            const isSelected = doc.id === activeDocId;
            const isProva = doc.category === 'prova';
            return (
              <div
                key={doc.id}
                onClick={() => onSelectDocument(doc.id)}
                className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-sky-500/10 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300 font-semibold'
                    : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-300'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs truncate">{doc.title}</p>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] opacity-65">
                    <span>{isProva ? 'Prova' : 'Apostila'}</span>
                    <span>•</span>
                    <span>{doc.pageCount || 1} págs</span>
                    {doc.annotationCount > 0 && (
                      <>
                        <span>•</span>
                        <span>{doc.annotationCount} notas</span>
                      </>
                    )}
                  </div>
                </div>

                {documents.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteDocument(doc.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-rose-500/10 text-rose-500 transition shrink-0"
                    title="Remover arquivo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Clean Pages Navigator */}
      <div className="p-3.5 border-t border-slate-100 dark:border-slate-800/80 h-48 flex flex-col">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            <span>Páginas</span>
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5 overflow-y-auto pr-1">
          {Array.from({ length: pageCount || 1 }, (_, i) => i + 1).map((pageNum) => {
            const pageAnns = (annotations || []).filter((a) => (a.page || 1) === pageNum);
            const isBookmarked = (bookmarkedPages || []).includes(pageNum);
            const isCurrent = currentPage === pageNum;

            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => onJumpToPage(pageNum)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition ${
                  isCurrent
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-semibold'
                    : 'bg-slate-100/70 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60'
                }`}
              >
                <span>Pág. {pageNum}</span>
                <div className="flex items-center gap-1">
                  {isBookmarked && (
                    <Bookmark
                      className={`w-3 h-3 fill-current ${
                        isCurrent ? 'text-amber-300' : 'text-amber-500'
                      }`}
                    />
                  )}
                  {pageAnns.length > 0 && (
                    <span className="text-[10px] opacity-75">({pageAnns.length})</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
