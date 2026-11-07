import React, { useState, useEffect, useRef, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import TopStudioBar from './components/TopStudioBar';
import StudySidebarRight from './components/StudySidebarRight';
import FloatingStudyToolbar from './components/FloatingStudyToolbar';
import PdfPageCanvas from './components/PdfPageCanvas';
import QuickSearchModal from './components/QuickSearchModal';
import { DEFAULT_CUSTOM_HIGHLIGHTERS } from './constants/studyTools';
import { Loader2, Upload } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [activeDocId, setActiveDocId] = useState(() => {
    return localStorage.getItem('papiro_last_doc_id') || null;
  });
  const [activeDocData, setActiveDocData] = useState(null);
  const [annotations, setAnnotations] = useState([]);
  const [undoStack, setUndoStack] = useState([]);

  const [customHighlighters, setCustomHighlighters] = useState(() => {
    try {
      const cached = localStorage.getItem('papiro_custom_highlighters');
      if (cached) return JSON.parse(cached);
    } catch (_e) {
      // ignore
    }
    return DEFAULT_CUSTOM_HIGHLIGHTERS;
  });

  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingPdf, setIsLoadingPdf] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const [zoom, setZoom] = useState(1.15);
  const [showNotesDrawer, setShowNotesDrawer] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const [activeTool, setActiveTool] = useState('highlight');
  const [toolOptions, setToolOptions] = useState({
    activeHighlighterId: DEFAULT_CUSTOM_HIGHLIGHTERS[0].id,
    highlightColor: DEFAULT_CUSTOM_HIGHLIGHTERS[0].hex,
    studyTag: DEFAULT_CUSTOM_HIGHLIGHTERS[0].tag,
    highlightStraight: true,
    highlightThickness: 0.022,
    postitColor: '#FEF9C3',
    inkColor: '#6D28D9',
    fontSize: 15,
    penThickness: 0.0036,
    stampType: 'check',
  });

  const [selectedAnnotationId, setSelectedAnnotationId] = useState(null);
  const [flashingAnnotationId, setFlashingAnnotationId] = useState(null);

  const viewportRef = useRef(null);
  const fileInputRef = useRef(null);

  const fetchDocumentsList = useCallback(async (preferredId = undefined) => {
    try {
      const [docsRes, settingsRes] = await Promise.all([
        fetch('/api/documents'),
        fetch('/api/settings'),
      ]);

      let serverLastId = null;
      if (settingsRes.ok) {
        const settingsJson = await settingsRes.json();
        serverLastId = settingsJson.lastActiveDocId;
        if (
          Array.isArray(settingsJson.customHighlighters) &&
          settingsJson.customHighlighters.length > 0
        ) {
          setCustomHighlighters(settingsJson.customHighlighters);
          localStorage.setItem(
            'papiro_custom_highlighters',
            JSON.stringify(settingsJson.customHighlighters)
          );
        }
      }

      if (docsRes.ok) {
        const list = await docsRes.json();
        setDocuments(list);

        if (list.length === 0) {
          setActiveDocId(null);
          setActiveDocData(null);
          setPdfDoc(null);
          setAnnotations([]);
          setIsLoadingPdf(false);
          localStorage.removeItem('papiro_last_doc_id');
          return;
        }

        const localLastId = localStorage.getItem('papiro_last_doc_id');
        const targetId =
          preferredId !== undefined
            ? preferredId
            : (localLastId && list.some((d) => d.id === localLastId) ? localLastId : null) ||
              (serverLastId && list.some((d) => d.id === serverLastId) ? serverLastId : null) ||
              list[0].id;

        setActiveDocId(targetId);
        if (targetId) {
          localStorage.setItem('papiro_last_doc_id', targetId);
        }
      }
    } catch (err) {
      console.error('Erro ao buscar documentos:', err);
      setIsLoadingPdf(false);
    }
  }, []);

  useEffect(() => {
    fetchDocumentsList();
  }, [fetchDocumentsList]);

  const handleUpdateCustomHighlighters = useCallback(async (nextHighlighters) => {
    setCustomHighlighters(nextHighlighters);
    localStorage.setItem(
      'papiro_custom_highlighters',
      JSON.stringify(nextHighlighters)
    );

    try {
      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customHighlighters: nextHighlighters }),
      });
    } catch (err) {
      console.error('Erro ao salvar cores:', err);
    }
  }, []);

  // Load active PDF document via streaming URL (fast & low-memory for large PDFs)
  useEffect(() => {
    if (!activeDocId) {
      setPdfDoc(null);
      setActiveDocData(null);
      setAnnotations([]);
      setIsLoadingPdf(false);
      return;
    }

    let cancelled = false;
    let loadingTask = null;
    localStorage.setItem('papiro_last_doc_id', activeDocId);

    async function loadActiveDocument() {
      setIsLoadingPdf(true);
      setSelectedAnnotationId(null);
      setUndoStack([]);
      try {
        const metaRes = await fetch(`/api/documents/${activeDocId}`);
        if (!metaRes.ok) throw new Error('Documento não encontrado');
        const docJson = await metaRes.json();
        if (cancelled) return;

        setActiveDocData(docJson);
        const serverAnns = docJson.annotations || [];
        setAnnotations(serverAnns);
        localStorage.setItem(
          `papiro_annotations_${activeDocId}`,
          JSON.stringify(serverAnns)
        );
        setCurrentPage(docJson.currentPage || 1);

        loadingTask = pdfjsLib.getDocument({
          url: `/api/documents/${activeDocId}/file`,
        });
        const loadedPdf = await loadingTask.promise;
        if (cancelled) return;

        setPdfDoc(loadedPdf);
        setPageCount(loadedPdf.numPages);
      } catch (err) {
        console.error('Erro ao abrir PDF:', err);
      } finally {
        if (!cancelled) setIsLoadingPdf(false);
      }
    }

    loadActiveDocument();
    return () => {
      cancelled = true;
      if (loadingTask) {
        try {
          loadingTask.destroy();
        } catch (_e) {
          // ignore
        }
      }
    };
  }, [activeDocId]);

  // Global Keyboard Shortcuts: Ctrl+L / Ctrl+F / Ctrl+K for Search & Go-to-Page
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && ['l', 'f', 'k', 'g'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        setIsSearchOpen((v) => !v);
        return;
      }

      const tag = document.activeElement?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedAnnotationId) {
        e.preventDefault();
        handleDeleteAnnotation(selectedAnnotationId);
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleUndo();
        return;
      }

      const key = e.key.toLowerCase();
      if (key === 'v') setActiveTool('select');
      else if (key === 'm') setActiveTool('highlight');
      else if (key === 'p') setActiveTool('postit');
      else if (key === 't') setActiveTool('text');
      else if (key === 'c') setActiveTool('pen');
      else if (key === 'e') setActiveTool('eraser');
      else if (key === '=' || key === '+') {
        e.preventDefault();
        setZoom((z) => Math.min(2.5, +(z + 0.15).toFixed(2)));
      } else if (key === '-') {
        e.preventDefault();
        setZoom((z) => Math.max(0.5, +(z - 0.15).toFixed(2)));
      } else if (key === 'escape') {
        setSelectedAnnotationId(null);
        setIsSearchOpen(false);
        setActiveTool('select');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  // Ctrl + Scroll Wheel Zoom
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.12 : -0.12;
        setZoom((prev) => Math.max(0.5, Math.min(2.5, +(prev + delta).toFixed(2))));
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  const pushUndoState = useCallback(() => {
    setUndoStack((prev) => [...prev.slice(-19), annotations]);
  }, [annotations]);

  const handleUndo = async () => {
    if (undoStack.length === 0 || !activeDocId) return;
    const previousAnnotations = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.slice(0, -1));
    setAnnotations(previousAnnotations);
    localStorage.setItem(
      `papiro_annotations_${activeDocId}`,
      JSON.stringify(previousAnnotations)
    );

    try {
      await fetch(`/api/documents/${activeDocId}/annotations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annotations: previousAnnotations }),
      });
    } catch (err) {
      console.error('Erro ao sincronizar undo:', err);
    }
  };

  const handleCreateAnnotation = useCallback(
    async (newAnnPayload) => {
      if (!activeDocId) return;
      pushUndoState();

      const annId = `ann-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const optimisticAnn = {
        ...newAnnPayload,
        id: annId,
        createdAt: new Date().toISOString(),
      };

      setAnnotations((prev) => {
        const next = [...prev, optimisticAnn];
        localStorage.setItem(`papiro_annotations_${activeDocId}`, JSON.stringify(next));
        return next;
      });

      if (newAnnPayload.type === 'postit' || newAnnPayload.type === 'text') {
        setSelectedAnnotationId(annId);
        setActiveTool('select');
      }

      try {
        const res = await fetch(`/api/documents/${activeDocId}/annotations`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(optimisticAnn),
        });
        if (res.ok) {
          const saved = await res.json();
          setAnnotations((prev) => {
            const next = prev.map((a) => (a.id === annId ? saved : a));
            localStorage.setItem(`papiro_annotations_${activeDocId}`, JSON.stringify(next));
            return next;
          });
        }
      } catch (err) {
        console.error('Erro ao salvar anotação:', err);
      }
    },
    [activeDocId, pushUndoState]
  );

  const handleUpdateAnnotation = useCallback(
    async (annId, patch, commit = true) => {
      setAnnotations((prev) => {
        const next = prev.map((a) => (a.id === annId ? { ...a, ...patch } : a));
        if (activeDocId) {
          localStorage.setItem(`papiro_annotations_${activeDocId}`, JSON.stringify(next));
        }
        return next;
      });

      if (commit && activeDocId) {
        try {
          await fetch(`/api/documents/${activeDocId}/annotations/${annId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
        } catch (err) {
          console.error('Erro ao atualizar anotação:', err);
        }
      }
    },
    [activeDocId]
  );

  const handleDeleteAnnotation = useCallback(
    async (annId) => {
      if (!activeDocId) return;
      pushUndoState();

      setAnnotations((prev) => {
        const next = prev.filter((a) => a.id !== annId);
        localStorage.setItem(`papiro_annotations_${activeDocId}`, JSON.stringify(next));
        return next;
      });

      setSelectedAnnotationId((prev) => (prev === annId ? null : prev));

      try {
        await fetch(`/api/documents/${activeDocId}/annotations/${annId}`, {
          method: 'DELETE',
        });
      } catch (err) {
        console.error('Erro ao excluir anotação:', err);
      }
    },
    [activeDocId, pushUndoState]
  );

  const handleClearPageAnnotations = async () => {
    if (!activeDocId) return;
    pushUndoState();
    const remaining = annotations.filter((a) => (a.page || 1) !== currentPage);
    setAnnotations(remaining);
    setSelectedAnnotationId(null);
    localStorage.setItem(
      `papiro_annotations_${activeDocId}`,
      JSON.stringify(remaining)
    );

    try {
      await fetch(`/api/documents/${activeDocId}/annotations`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ annotations: remaining }),
      });
    } catch (err) {
      console.error('Erro ao limpar página:', err);
    }
  };

  const handleUploadFile = async (file) => {
    if (!file) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

      const res = await fetch('/api/documents', {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Erro no upload');
      const createdDoc = await res.json();
      localStorage.setItem('papiro_last_doc_id', createdDoc.id);
      await fetchDocumentsList(createdDoc.id);
    } catch (err) {
      console.error('Falha ao enviar arquivo:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    try {
      await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
      localStorage.removeItem(`papiro_annotations_${docId}`);

      const remaining = documents.filter((d) => d.id !== docId);
      setDocuments(remaining);

      if (remaining.length === 0) {
        setActiveDocId(null);
        setActiveDocData(null);
        setPdfDoc(null);
        setAnnotations([]);
        localStorage.removeItem('papiro_last_doc_id');
      } else if (activeDocId === docId) {
        const nextId = remaining[0].id;
        setActiveDocId(nextId);
        localStorage.setItem('papiro_last_doc_id', nextId);
      }
    } catch (err) {
      console.error('Erro ao apagar PDF:', err);
    }
  };

  const handleJumpToPage = useCallback((pageNum) => {
    setCurrentPage(pageNum);
    const pageEl = document.getElementById(`pdf-page-${pageNum}`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'auto', block: 'start' });
    }
  }, []);

  const handleJumpToAnnotation = useCallback((ann) => {
    const targetPage = ann.page || 1;
    setCurrentPage(targetPage);
    setSelectedAnnotationId(ann.id);
    setFlashingAnnotationId(ann.id);

    const pageEl = document.getElementById(`pdf-page-${targetPage}`);
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => setFlashingAnnotationId(null), 2000);
  }, []);

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const file = e.dataTransfer.files?.[0];
        if (file) handleUploadFile(file);
      }}
      className="h-screen w-screen flex flex-col overflow-hidden bg-[#F5F4F9] text-zinc-800 font-sans"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.txt,.md,application/pdf,text/plain"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            handleUploadFile(file);
            e.target.value = '';
          }
        }}
        className="hidden"
      />

      <TopStudioBar
        documents={documents}
        activeDocId={activeDocId}
        documentData={activeDocData}
        currentPage={currentPage}
        pageCount={pageCount}
        zoom={zoom}
        annotationsCount={annotations.length}
        pageAnnotationsCount={
          annotations.filter((a) => (a.page || 1) === currentPage).length
        }
        showNotesDrawer={showNotesDrawer}
        onSelectDocument={(id) => {
          setActiveDocId(id);
          localStorage.setItem('papiro_last_doc_id', id);
        }}
        onDeleteDocument={handleDeleteDocument}
        onUploadClick={() => fileInputRef.current?.click()}
        onChangeZoom={setZoom}
        onJumpToPage={handleJumpToPage}
        onOpenSearch={() => setIsSearchOpen(true)}
        onClearPageAnnotations={handleClearPageAnnotations}
        onToggleNotesDrawer={() => setShowNotesDrawer((v) => !v)}
      />

      {/* Quick Search & Go-to-Page Modal (Ctrl + L) */}
      <QuickSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        pdfDoc={pdfDoc}
        pageCount={pageCount}
        currentPage={currentPage}
        annotations={annotations}
        customHighlighters={customHighlighters}
        onJumpToPage={handleJumpToPage}
        onJumpToAnnotation={handleJumpToAnnotation}
      />

      <div className="flex-1 flex min-h-0 relative">
        <main
          ref={viewportRef}
          className="flex-1 overflow-auto px-4 sm:px-8 pt-6 pb-32 relative"
        >
          {isLoadingPdf || isUploading ? (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-zinc-400">
              <Loader2 className="w-7 h-7 animate-spin text-violet-600" />
              <p className="text-xs font-medium">
                {isUploading ? 'Abrindo seu PDF...' : 'Carregando...'}
              </p>
            </div>
          ) : !pdfDoc ? (
            <div className="h-full flex flex-col items-center justify-center">
              <div className="bg-white p-8 rounded-3xl shadow-page border border-violet-100 text-center max-w-sm">
                <p className="text-sm font-semibold text-zinc-800 mb-1">
                  Nenhum PDF aberto
                </p>
                <p className="text-xs text-zinc-400 mb-5">
                  Escolha uma apostila ou prova do seu computador para começar a estudar.
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium flex items-center justify-center gap-2 transition shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>Escolher PDF do computador</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {Array.from({ length: pageCount }, (_, idx) => idx + 1).map((pageNum) => (
                <PdfPageCanvas
                  key={`${activeDocId}-page-${pageNum}`}
                  pdfDoc={pdfDoc}
                  pageNumber={pageNum}
                  zoom={zoom}
                  activeTool={activeTool}
                  toolOptions={toolOptions}
                  customHighlighters={customHighlighters}
                  annotations={annotations.filter((a) => (a.page || 1) === pageNum)}
                  selectedAnnotationId={selectedAnnotationId}
                  flashingAnnotationId={flashingAnnotationId}
                  onSelectAnnotation={setSelectedAnnotationId}
                  onCreateAnnotation={handleCreateAnnotation}
                  onUpdateAnnotation={handleUpdateAnnotation}
                  onDeleteAnnotation={handleDeleteAnnotation}
                  onPageVisible={setCurrentPage}
                />
              ))}
            </div>
          )}

          {pdfDoc && (
            <FloatingStudyToolbar
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              toolOptions={toolOptions}
              onChangeToolOptions={(patch) =>
                setToolOptions((prev) => ({ ...prev, ...patch }))
              }
              customHighlighters={customHighlighters}
              onUpdateCustomHighlighters={handleUpdateCustomHighlighters}
              canUndo={undoStack.length > 0}
              onUndo={handleUndo}
            />
          )}
        </main>

        {showNotesDrawer && pdfDoc && (
          <StudySidebarRight
            annotations={annotations}
            customHighlighters={customHighlighters}
            onJumpToAnnotation={handleJumpToAnnotation}
            onDeleteAnnotation={handleDeleteAnnotation}
            onCreateQuickPostit={() =>
              handleCreateAnnotation({
                page: currentPage,
                type: 'postit',
                x: 0.65,
                y: 0.18,
                width: 0.26,
                color: toolOptions.postitColor || '#FEF9C3',
                tag: toolOptions.studyTag || customHighlighters?.[0]?.tag || 'Nota',
                title: '',
                text: '',
                collapsed: false,
              })
            }
            onClose={() => setShowNotesDrawer(false)}
          />
        )}
      </div>
    </div>
  );
}
