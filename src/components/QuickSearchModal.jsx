import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, ArrowRight, X, FileText, Highlighter } from 'lucide-react';

export default function QuickSearchModal({
  isOpen,
  onClose,
  pdfDoc,
  pageCount,
  currentPage,
  annotations,
  customHighlighters,
  onJumpToPage,
  onJumpToAnnotation,
}) {
  const [query, setQuery] = useState('');
  const [pageInput, setPageInput] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [pdfTextIndex, setPdfTextIndex] = useState({});
  const [isIndexing, setIsIndexing] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setPageInput(String(currentPage || 1));
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 30);
    }
  }, [isOpen, currentPage]);

  // Index PDF text in background when modal opens (chunked so it never blocks UI on large PDFs)
  useEffect(() => {
    if (!isOpen || !pdfDoc) return;
    let cancelled = false;

    async function indexPages() {
      const total = pdfDoc.numPages;
      if (Object.keys(pdfTextIndex).length >= total) return;

      setIsIndexing(true);
      const nextIndex = { ...pdfTextIndex };

      for (let p = 1; p <= total; p++) {
        if (cancelled) break;
        if (nextIndex[p] !== undefined) continue;

        try {
          const page = await pdfDoc.getPage(p);
          const content = await page.getTextContent();
          nextIndex[p] = (content?.items || [])
            .map((it) => it.str || '')
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
        } catch (_e) {
          nextIndex[p] = '';
        }

        // Yield to main thread every 5 pages so large PDFs stay 60fps
        if (p % 5 === 0) {
          setPdfTextIndex({ ...nextIndex });
          await new Promise((r) => setTimeout(r, 12));
        }
      }

      if (!cancelled) {
        setPdfTextIndex({ ...nextIndex });
        setIsIndexing(false);
      }
    }

    indexPages();
    return () => {
      cancelled = true;
    };
  }, [isOpen, pdfDoc]);

  // Search results combining: (1) Direct page number match, (2) User Annotations, (3) PDF Page Text
  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = [];

    // 1. Annotations matching query and tag filter
    (annotations || []).forEach((ann) => {
      if (selectedTag !== 'all' && ann.tag !== selectedTag) return;
      const text = `${ann.tag || ''} ${ann.title || ''} ${ann.text || ''} ${ann.label || ''}`;
      if (!q || text.toLowerCase().includes(q)) {
        list.push({
          id: `ann-${ann.id}`,
          type: 'annotation',
          page: ann.page || 1,
          color: ann.color || '#FDE047',
          tag: ann.tag || 'Marcação',
          snippet: ann.text || ann.label || ann.title || 'Marcação nesta página',
          annotation: ann,
        });
      }
    });

    // 2. PDF text matches when user types a search query
    if (q && selectedTag === 'all') {
      Object.entries(pdfTextIndex).forEach(([pageStr, fullText]) => {
        const lower = fullText.toLowerCase();
        const idx = lower.indexOf(q);
        if (idx !== -1) {
          const start = Math.max(0, idx - 40);
          const end = Math.min(fullText.length, idx + q.length + 70);
          const snippet =
            (start > 0 ? '...' : '') +
            fullText.slice(start, end) +
            (end < fullText.length ? '...' : '');

          list.push({
            id: `pdf-page-${pageStr}-${idx}`,
            type: 'pdf-text',
            page: Number(pageStr),
            snippet,
          });
        }
      });
    }

    return list.slice(0, 40);
  }, [query, selectedTag, annotations, pdfTextIndex]);

  if (!isOpen) return null;

  const handleGoToPageSubmit = (e) => {
    e.preventDefault();
    const num = parseInt(pageInput, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= (pageCount || 1)) {
      onJumpToPage(num);
      onClose();
    }
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'Enter') {
      // If user typed just a page number in the main search input, jump straight to that page!
      const pureNumber = /^\d+$/.test(query.trim()) ? parseInt(query.trim(), 10) : null;
      if (pureNumber && pureNumber >= 1 && pureNumber <= (pageCount || 1)) {
        onJumpToPage(pureNumber);
        onClose();
        return;
      }
      if (results.length > 0) {
        const first = results[0];
        if (first.type === 'annotation') {
          onJumpToAnnotation(first.annotation);
        } else {
          onJumpToPage(first.page);
        }
        onClose();
      }
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-zinc-900/25 backdrop-blur-xs flex items-start justify-center pt-16 px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl bg-white rounded-3xl shadow-float border border-violet-100 overflow-hidden"
      >
        {/* Top Search & Go-to-Page Bar */}
        <div className="p-3.5 border-b border-violet-100 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          {/* Search Input */}
          <div className="relative flex-1 flex items-center">
            <Search className="w-4 h-4 text-violet-500 absolute left-3" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Pesquisar palavra no PDF, anotação ou digite o nº da página..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#F5F4F9] text-xs text-zinc-800 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>

          {/* Direct Go-to-Page Box */}
          <form onSubmit={handleGoToPageSubmit} className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-zinc-400 pl-1">Ir p/ pág:</span>
            <input
              type="number"
              min={1}
              max={pageCount || 1}
              value={pageInput}
              onChange={(e) => setPageInput(e.target.value)}
              className="w-16 px-2.5 py-2 rounded-xl bg-[#F5F4F9] text-xs font-semibold text-center text-violet-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
            <button
              type="submit"
              className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-medium flex items-center gap-1 transition"
            >
              <span>Ir</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          <button
            type="button"
            onClick={onClose}
            className="hidden sm:flex p-1.5 rounded-xl text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Filter by User's Custom Highlighter Colors/Names */}
        <div className="px-4 py-2.5 bg-[#FAF9FC] border-b border-violet-50 flex items-center gap-1.5 overflow-x-auto">
          <span className="text-[11px] text-zinc-400 mr-1 shrink-0">Filtrar marcações:</span>
          <button
            type="button"
            onClick={() => setSelectedTag('all')}
            className={`px-2.5 py-1 rounded-xl text-xs font-medium transition whitespace-nowrap ${
              selectedTag === 'all'
                ? 'bg-violet-600 text-white'
                : 'bg-white text-zinc-600 hover:bg-violet-50 border border-violet-100'
            }`}
          >
            Tudo
          </button>
          {(customHighlighters || []).map((hl) => (
            <button
              key={hl.id}
              type="button"
              onClick={() => setSelectedTag(selectedTag === hl.tag ? 'all' : hl.tag)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-medium transition whitespace-nowrap ${
                selectedTag === hl.tag
                  ? 'bg-violet-600 text-white'
                  : 'bg-white text-zinc-700 hover:bg-violet-50 border border-violet-100'
              }`}
            >
              <span
                style={{ backgroundColor: hl.hex }}
                className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
              />
              <span>{hl.tag}</span>
            </button>
          ))}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-3 space-y-1.5">
          {/^\d+$/.test(query.trim()) &&
            parseInt(query.trim(), 10) >= 1 &&
            parseInt(query.trim(), 10) <= (pageCount || 1) && (
              <button
                type="button"
                onClick={() => {
                  onJumpToPage(parseInt(query.trim(), 10));
                  onClose();
                }}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-violet-50 hover:bg-violet-100 text-violet-900 text-xs font-semibold transition"
              >
                <span>Ir direto para a Página {query.trim()}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

          {results.length === 0 ? (
            <div className="py-10 text-center text-xs text-zinc-400">
              {isIndexing
                ? 'Lendo páginas do PDF para pesquisa...'
                : query.trim()
                ? 'Nenhum resultado encontrado para essa busca.'
                : 'Digite uma palavra para pesquisar no PDF, filtre por cor acima ou digite o número da página.'}
            </div>
          ) : (
            results.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (item.type === 'annotation') {
                    onJumpToAnnotation(item.annotation);
                  } else {
                    onJumpToPage(item.page);
                  }
                  onClose();
                }}
                className="w-full text-left p-3 rounded-2xl hover:bg-[#F5F4F9] transition flex items-start justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    {item.type === 'annotation' ? (
                      <>
                        <span
                          style={{ backgroundColor: item.color }}
                          className="w-2.5 h-2.5 rounded-full border border-black/15 shrink-0"
                        />
                        <span className="text-xs font-semibold text-violet-900">
                          {item.tag}
                        </span>
                      </>
                    ) : (
                      <>
                        <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                        <span className="text-xs font-medium text-zinc-500">
                          Texto na apostila/prova
                        </span>
                      </>
                    )}
                  </div>
                  <p className="text-xs text-zinc-700 line-clamp-2">{item.snippet}</p>
                </div>

                <span className="px-2.5 py-1 rounded-xl bg-violet-50 text-violet-700 text-xs font-semibold shrink-0">
                  Pág. {item.page}
                </span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
