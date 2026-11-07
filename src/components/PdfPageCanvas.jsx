import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Trash2, Minus, Plus } from 'lucide-react';
import PostItWidget from './PostItWidget';
import { TextAnnotationWidget, StampAnnotationWidget } from './PageOverlayWidgets';
import { POSTIT_COLORS, STAMP_TYPES } from '../constants/studyTools';

function pointsToSvgPath(points) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    const x = (points[0].x * 1000).toFixed(1);
    const y = (points[0].y * 1000).toFixed(1);
    return `M ${x} ${y} L ${x} ${y}`;
  }
  return points
    .map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${(pt.x * 1000).toFixed(1)} ${(pt.y * 1000).toFixed(1)}`)
    .join(' ');
}

// Compute bounding rect in 0..1000 SVG space for a rectilinear/multiline highlight
function getHighlightRect(ann) {
  const pts = ann.points || [];
  if (pts.length < 2) return null;
  const p0 = pts[0];
  const p1 = pts[pts.length - 1];
  const thickness = ann.strokeWidth || 0.014;

  const minX = Math.min(p0.x, p1.x);
  const maxX = Math.max(p0.x, p1.x);
  const minY = Math.min(p0.y, p1.y) - thickness / 2;
  const maxY = Math.max(p0.y, p1.y) + thickness / 2;

  return {
    x: minX * 1000,
    y: minY * 1000,
    width: Math.max(6, (maxX - minX) * 1000),
    height: Math.max(thickness * 1000, (maxY - minY) * 1000),
    p0,
    p1,
  };
}

const PdfPageCanvas = memo(function PdfPageCanvas({
  pdfDoc,
  pageNumber,
  zoom,
  activeTool,
  toolOptions,
  customHighlighters,
  annotations,
  selectedAnnotationId,
  flashingAnnotationId,
  onSelectAnnotation,
  onCreateAnnotation,
  onUpdateAnnotation,
  onDeleteAnnotation,
  onPageVisible,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const textItemsRef = useRef([]);

  const [baseSize, setBaseSize] = useState({ width: 595.28, height: 841.89 });
  const [isNearViewport, setIsNearViewport] = useState(pageNumber <= 3);
  const [draftStroke, setDraftStroke] = useState(null);
  const [isErasing, setIsErasing] = useState(false);
  // Handle resizing an existing highlight's start or end point (to shrink it or pull down to next line)
  const [resizingHandle, setResizingHandle] = useState(null); // { annId, which: 'start' | 'end' }

  const dimensions = {
    width: Math.round(baseSize.width * zoom),
    height: Math.round(baseSize.height * zoom),
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const nearObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          setIsNearViewport(entry.isIntersecting);
        });
      },
      { rootMargin: '1400px 0px' }
    );

    const activePageObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.4) {
            onPageVisible?.(pageNumber);
          }
        });
      },
      { threshold: [0.4] }
    );

    nearObserver.observe(el);
    activePageObserver.observe(el);

    return () => {
      nearObserver.disconnect();
      activePageObserver.disconnect();
    };
  }, [pageNumber, onPageVisible]);

  useEffect(() => {
    if (!isNearViewport || !pdfDoc) return;
    let cancelled = false;

    async function renderPage() {
      if (!canvasRef.current) return;
      try {
        const page = await pdfDoc.getPage(pageNumber);
        if (cancelled || !canvasRef.current) return;

        const unscaledViewport = page.getViewport({ scale: 1 });
        setBaseSize({
          width: unscaledViewport.width,
          height: unscaledViewport.height,
        });

        const viewport = page.getViewport({ scale: zoom });
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d', { alpha: false });

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.round(viewport.width)}px`;
        canvas.style.height = `${Math.round(viewport.height)}px`;

        if (renderTaskRef.current) {
          try {
            renderTaskRef.current.cancel();
          } catch (_e) {
            // ignore
          }
        }

        const renderContext = {
          canvasContext: ctx,
          viewport,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;

        if (textItemsRef.current.length === 0 && !cancelled) {
          const textContent = await page.getTextContent();
          if (!cancelled && textContent?.items) {
            textItemsRef.current = textContent.items
              .filter((item) => item.str && item.str.trim())
              .map((item) => {
                const tx = item.transform[4];
                const ty = item.transform[5];
                const normX = tx / unscaledViewport.width;
                const normY = (unscaledViewport.height - ty) / unscaledViewport.height;
                const normW = (item.width || 40) / unscaledViewport.width;
                return {
                  str: item.str.trim(),
                  x1: normX,
                  x2: normX + normW,
                  y: normY,
                };
              });
          }
        }
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.warn(`Aviso ao renderizar página ${pageNumber}:`, err);
        }
      }
    }

    renderPage();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (_e) {
          // ignore
        }
      }
    };
  }, [pdfDoc, pageNumber, zoom, isNearViewport]);

  const getNormalizedCoords = useCallback((clientX, clientY) => {
    if (!containerRef.current) return { x: 0.5, y: 0.5 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0.005, Math.min(0.995, (clientX - rect.left) / rect.width));
    const y = Math.max(0.005, Math.min(0.995, (clientY - rect.top) / rect.height));
    return { x, y };
  }, []);

  const extractHighlightedSnippet = useCallback((points) => {
    if (!points || points.length === 0 || textItemsRef.current.length === 0) return '';
    const xs = points.map((p) => p.x);
    const ys = points.map((p) => p.y);
    const minX = Math.min(...xs) - 0.03;
    const maxX = Math.max(...xs) + 0.03;
    const minY = Math.min(...ys) - 0.022;
    const maxY = Math.max(...ys) + 0.022;

    const matched = textItemsRef.current.filter(
      (item) =>
        item.y >= minY &&
        item.y <= maxY &&
        item.x2 >= minX &&
        item.x1 <= maxX
    );

    if (matched.length === 0) return '';
    return matched
      .map((m) => m.str)
      .join(' ')
      .slice(0, 140);
  }, []);

  const handleMouseDown = (e) => {
    if (e.button !== 0 || !isNearViewport) return;

    const pt = getNormalizedCoords(e.clientX, e.clientY);

    if (activeTool === 'select') {
      onSelectAnnotation(null);
      return;
    }

    if (activeTool === 'eraser') {
      setIsErasing(true);
      return;
    }

    if (activeTool === 'postit') {
      const colorDef =
        POSTIT_COLORS.find((c) => c.hex === toolOptions.postitColor) || POSTIT_COLORS[0];
      onCreateAnnotation({
        page: pageNumber,
        type: 'postit',
        x: Math.min(0.7, pt.x),
        y: Math.min(0.82, pt.y),
        width: 0.27,
        color: colorDef.hex,
        tag: toolOptions.studyTag || customHighlighters?.[0]?.tag || 'Nota',
        title: '',
        text: '',
        collapsed: false,
      });
      return;
    }

    if (activeTool === 'text') {
      onCreateAnnotation({
        page: pageNumber,
        type: 'text',
        x: Math.min(0.78, pt.x),
        y: Math.min(0.92, pt.y),
        color: toolOptions.inkColor || '#6D28D9',
        fontSize: toolOptions.fontSize || 15,
        text: '',
        autoFocus: true,
      });
      return;
    }

    if (activeTool === 'stamp') {
      const stampDef =
        STAMP_TYPES.find((s) => s.id === toolOptions.stampType) || STAMP_TYPES[0];
      onCreateAnnotation({
        page: pageNumber,
        type: 'stamp',
        x: pt.x,
        y: pt.y,
        stampType: stampDef.id,
        color: stampDef.color,
        label: stampDef.label,
      });
      return;
    }

    if (activeTool === 'highlight') {
      const activeHl =
        (customHighlighters || []).find((h) => h.id === toolOptions.activeHighlighterId) ||
        (customHighlighters || []).find(
          (h) => h.hex.toLowerCase() === (toolOptions.highlightColor || '').toLowerCase()
        ) ||
        customHighlighters?.[0] || { hex: '#FDE047', tag: 'Importante' };

      const mode = toolOptions.highlightMode || 'multiline';

      setDraftStroke({
        type: 'highlight',
        mode,
        color: toolOptions.highlightColor || activeHl.hex,
        tag: toolOptions.studyTag || activeHl.tag,
        opacity: 0.42,
        strokeWidth: toolOptions.highlightThickness || 0.014,
        points: [pt, pt],
      });
      return;
    }

    if (activeTool === 'pen') {
      setDraftStroke({
        type: 'pen',
        color: toolOptions.inkColor || '#6D28D9',
        strokeWidth: toolOptions.penThickness || 0.0036,
        points: [pt],
      });
    }
  };

  const handleMouseMove = (e) => {
    // 1. If dragging a resize handle of an existing highlight (to shrink it or pull down to next line)
    if (resizingHandle) {
      const pt = getNormalizedCoords(e.clientX, e.clientY);
      const targetAnn = annotations.find((a) => a.id === resizingHandle.annId);
      if (targetAnn && targetAnn.points?.length >= 2) {
        const p0 = targetAnn.points[0];
        const p1 = targetAnn.points[targetAnn.points.length - 1];
        const nextPoints =
          resizingHandle.which === 'start' ? [pt, p1] : [p0, pt];
        onUpdateAnnotation(resizingHandle.annId, { points: nextPoints }, false);
      }
      return;
    }

    // 2. If drawing a new highlight or pen stroke
    if (!draftStroke) return;
    const pt = getNormalizedCoords(e.clientX, e.clientY);

    if (draftStroke.type === 'highlight' && draftStroke.mode !== 'free') {
      const startPt = draftStroke.points[0];
      // If user stays roughly on the same line, snap Y smoothly; if they drag down/up to another line, allow Y to go to the line below!
      const dy = Math.abs(pt.y - startPt.y);
      const targetY = dy < 0.009 ? startPt.y : pt.y;
      setDraftStroke((prev) => ({
        ...prev,
        points: [startPt, { x: pt.x, y: targetY }],
      }));
    } else {
      setDraftStroke((prev) => ({
        ...prev,
        points: [...prev.points, pt],
      }));
    }
  };

  const finishStroke = () => {
    if (resizingHandle) {
      const targetAnn = annotations.find((a) => a.id === resizingHandle.annId);
      if (targetAnn) {
        onUpdateAnnotation(resizingHandle.annId, { points: targetAnn.points }, true);
      }
      setResizingHandle(null);
      return;
    }

    if (isErasing) {
      setIsErasing(false);
    }
    if (!draftStroke) return;

    const pts = draftStroke.points;
    if (pts.length >= 2) {
      const dx = pts[pts.length - 1].x - pts[0].x;
      const dy = pts[pts.length - 1].y - pts[0].y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0.006) {
        const snippet =
          draftStroke.type === 'highlight' ? extractHighlightedSnippet(pts) : '';

        onCreateAnnotation({
          page: pageNumber,
          type: draftStroke.type,
          mode: draftStroke.mode || 'multiline',
          color: draftStroke.color,
          tag: draftStroke.tag || 'Marca-texto',
          opacity: draftStroke.opacity || 0.42,
          strokeWidth: draftStroke.strokeWidth,
          points: pts,
          label:
            snippet ||
            (draftStroke.type === 'highlight'
              ? `${draftStroke.tag || 'Marcação'}`
              : 'Anotação'),
        });
      }
    }
    setDraftStroke(null);
  };

  const vectorAnnotations = annotations.filter(
    (a) => a.type === 'highlight' || a.type === 'pen'
  );
  const postitAnnotations = annotations.filter((a) => a.type === 'postit');
  const textAnnotations = annotations.filter((a) => a.type === 'text');
  const stampAnnotations = annotations.filter((a) => a.type === 'stamp');

  const selectedVector = vectorAnnotations.find((a) => a.id === selectedAnnotationId);

  const cursorClass =
    activeTool === 'highlight' || activeTool === 'pen'
      ? 'cursor-crosshair'
      : activeTool === 'text'
      ? 'cursor-text'
      : activeTool === 'postit'
      ? 'cursor-copy'
      : activeTool === 'eraser'
      ? 'cursor-pointer'
      : 'cursor-default';

  return (
    <div
      id={`pdf-page-${pageNumber}`}
      ref={containerRef}
      style={{
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={finishStroke}
      onMouseLeave={finishStroke}
      className={`relative bg-white shadow-page rounded-xl select-none mx-auto mb-7 border border-violet-100/70 ${cursorClass}`}
    >
      <span className="absolute top-2.5 right-3 z-10 text-[10px] font-medium text-zinc-400 bg-zinc-100/80 px-2 py-0.5 rounded-full pointer-events-none">
        Pág. {pageNumber}
      </span>

      {isNearViewport ? (
        <>
          {/* Layer 1: High-DPI PDF Canvas */}
          <canvas
            ref={canvasRef}
            className="block pointer-events-none rounded-xl"
          />

          {/* Layer 2: Vector SVG Layer for Marca-texto & Caneta */}
          <svg
            viewBox="0 0 1000 1000"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full z-20 pointer-events-none"
          >
            {vectorAnnotations.map((ann) => {
              const isHighlight = ann.type === 'highlight';
              const isSelected = ann.id === selectedAnnotationId;
              const isFlashing = ann.id === flashingAnnotationId;
              const strokeWidthSvg =
                (ann.strokeWidth || (isHighlight ? 0.014 : 0.003)) * 1000;

              // Check if this is a 2-point rect/multiline highlight vs freehand path
              const isBoxHighlight =
                isHighlight &&
                ann.mode !== 'free' &&
                ann.points &&
                ann.points.length === 2;

              if (isBoxHighlight) {
                const rect = getHighlightRect(ann);
                if (!rect) return null;

                return (
                  <g key={ann.id}>
                    {isSelected && (
                      <rect
                        x={rect.x - 2}
                        y={rect.y - 2}
                        width={rect.width + 4}
                        height={rect.height + 4}
                        rx={4}
                        fill="none"
                        stroke="#7C3AED"
                        strokeWidth={2.5}
                      />
                    )}
                    <rect
                      x={rect.x}
                      y={rect.y}
                      width={rect.width}
                      height={rect.height}
                      rx={3}
                      fill={ann.color || '#FDE047'}
                      opacity={ann.opacity || 0.42}
                      style={{
                        mixBlendMode: 'multiply',
                        pointerEvents: 'all',
                        cursor: 'pointer',
                      }}
                      className={isFlashing ? 'animate-pulse' : ''}
                      onMouseEnter={() => {
                        if (activeTool === 'eraser' && isErasing) {
                          onDeleteAnnotation(ann.id);
                        }
                      }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        if (activeTool === 'eraser') {
                          onDeleteAnnotation(ann.id);
                        } else {
                          onSelectAnnotation(ann.id);
                        }
                      }}
                    />

                    {/* Draggable Resize Handles when Selected: Shrink or Pull down to next line! */}
                    {isSelected && (
                      <>
                        {/* Start Handle (Left / Top-Left) */}
                        <circle
                          cx={rect.p0.x * 1000}
                          cy={rect.p0.y * 1000}
                          r={7}
                          fill="#7C3AED"
                          stroke="#FFFFFF"
                          strokeWidth={2}
                          style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setResizingHandle({ annId: ann.id, which: 'start' });
                          }}
                        />
                        {/* End Handle (Right / Bottom-Right) */}
                        <circle
                          cx={rect.p1.x * 1000}
                          cy={rect.p1.y * 1000}
                          r={7}
                          fill="#7C3AED"
                          stroke="#FFFFFF"
                          strokeWidth={2}
                          style={{ pointerEvents: 'all', cursor: 'nwse-resize' }}
                          onMouseDown={(e) => {
                            e.stopPropagation();
                            setResizingHandle({ annId: ann.id, which: 'end' });
                          }}
                        />
                      </>
                    )}
                  </g>
                );
              }

              return (
                <g key={ann.id}>
                  {isSelected && (
                    <path
                      d={pointsToSvgPath(ann.points)}
                      fill="none"
                      stroke="#7C3AED"
                      strokeWidth={strokeWidthSvg + 5}
                      strokeLinecap={isHighlight ? 'round' : 'round'}
                      strokeLinejoin="round"
                      opacity={0.4}
                    />
                  )}
                  <path
                    d={pointsToSvgPath(ann.points)}
                    fill="none"
                    stroke={ann.color || '#FDE047'}
                    strokeWidth={strokeWidthSvg}
                    strokeLinecap={isHighlight ? 'round' : 'round'}
                    strokeLinejoin="round"
                    opacity={isHighlight ? ann.opacity || 0.42 : 0.92}
                    style={{
                      mixBlendMode: isHighlight ? 'multiply' : 'normal',
                      pointerEvents: 'stroke',
                      cursor: 'pointer',
                    }}
                    className={isFlashing ? 'animate-pulse' : ''}
                    onMouseEnter={() => {
                      if (activeTool === 'eraser' && isErasing) {
                        onDeleteAnnotation(ann.id);
                      }
                    }}
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (activeTool === 'eraser') {
                        onDeleteAnnotation(ann.id);
                      } else {
                        onSelectAnnotation(ann.id);
                      }
                    }}
                  />
                </g>
              );
            })}

            {/* Active Draft Stroke while dragging */}
            {draftStroke &&
              (draftStroke.type === 'highlight' &&
              draftStroke.mode !== 'free' &&
              draftStroke.points.length === 2 ? (
                (() => {
                  const r = getHighlightRect(draftStroke);
                  if (!r) return null;
                  return (
                    <rect
                      x={r.x}
                      y={r.y}
                      width={r.width}
                      height={r.height}
                      rx={3}
                      fill={draftStroke.color}
                      opacity={0.42}
                      style={{ mixBlendMode: 'multiply' }}
                    />
                  );
                })()
              ) : (
                <path
                  d={pointsToSvgPath(draftStroke.points)}
                  fill="none"
                  stroke={draftStroke.color}
                  strokeWidth={draftStroke.strokeWidth * 1000}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={draftStroke.type === 'highlight' ? 0.42 : 0.9}
                  style={{
                    mixBlendMode:
                      draftStroke.type === 'highlight' ? 'multiply' : 'normal',
                  }}
                />
              ))}
          </svg>

          {/* Popover when a Highlight or Pen Stroke is clicked: Shrink/Grow thickness, Change color, or Delete */}
          {selectedVector && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                left: `${Math.min(0.55, selectedVector.points?.[0]?.x || 0.2) * dimensions.width}px`,
                top: `${Math.max(0.02, (selectedVector.points?.[0]?.y || 0.2) - 0.055) * dimensions.height}px`,
              }}
              className="absolute z-50 flex items-center gap-2 bg-white text-zinc-800 px-3 py-1.5 rounded-2xl shadow-float border border-violet-100 text-xs"
            >
              {/* Shrink / Grow Thickness of this highlight */}
              {selectedVector.type === 'highlight' && (
                <div className="flex items-center gap-1 pr-1 border-r border-zinc-200">
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateAnnotation(
                        selectedVector.id,
                        {
                          strokeWidth: Math.max(
                            0.006,
                            +((selectedVector.strokeWidth || 0.014) - 0.003).toFixed(3)
                          ),
                        },
                        true
                      )
                    }
                    className="p-1 rounded-lg bg-[#F5F4F9] hover:bg-violet-50 text-zinc-700"
                    title="Diminuir altura do marca-texto"
                  >
                    <Minus className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateAnnotation(
                        selectedVector.id,
                        {
                          strokeWidth: Math.min(
                            0.045,
                            +((selectedVector.strokeWidth || 0.014) + 0.003).toFixed(3)
                          ),
                        },
                        true
                      )
                    }
                    className="p-1 rounded-lg bg-[#F5F4F9] hover:bg-violet-50 text-zinc-700"
                    title="Aumentar altura do marca-texto"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              )}

              {selectedVector.type === 'highlight' &&
                (customHighlighters || []).map((hl) => (
                  <button
                    key={hl.id}
                    type="button"
                    onClick={() =>
                      onUpdateAnnotation(
                        selectedVector.id,
                        { color: hl.hex, tag: hl.tag },
                        true
                      )
                    }
                    style={{ backgroundColor: hl.hex }}
                    className="w-4 h-4 rounded-full border border-black/20 hover:scale-110 transition-transform"
                    title={hl.tag}
                  />
                ))}

              <button
                type="button"
                onClick={() => onDeleteAnnotation(selectedVector.id)}
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 font-medium transition"
                title="Apagar esta marcação"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Apagar</span>
              </button>
            </div>
          )}

          {/* Layer 3: Interactive HTML Overlays */}
          <div className="absolute inset-0 z-30 pointer-events-none">
            {stampAnnotations.map((ann) => (
              <div
                key={ann.id}
                className="pointer-events-auto"
                onClickCapture={(e) => {
                  if (activeTool === 'eraser') {
                    e.stopPropagation();
                    onDeleteAnnotation(ann.id);
                  }
                }}
              >
                <StampAnnotationWidget
                  annotation={ann}
                  pageWidth={dimensions.width}
                  pageHeight={dimensions.height}
                  zoom={zoom}
                  isSelected={ann.id === selectedAnnotationId}
                  isFlashing={ann.id === flashingAnnotationId}
                  onSelect={onSelectAnnotation}
                  onUpdate={onUpdateAnnotation}
                  onDelete={onDeleteAnnotation}
                />
              </div>
            ))}

            {textAnnotations.map((ann) => (
              <div
                key={ann.id}
                className="pointer-events-auto"
                onClickCapture={(e) => {
                  if (activeTool === 'eraser') {
                    e.stopPropagation();
                    onDeleteAnnotation(ann.id);
                  }
                }}
              >
                <TextAnnotationWidget
                  annotation={ann}
                  pageWidth={dimensions.width}
                  pageHeight={dimensions.height}
                  zoom={zoom}
                  isSelected={ann.id === selectedAnnotationId}
                  isFlashing={ann.id === flashingAnnotationId}
                  onSelect={onSelectAnnotation}
                  onUpdate={onUpdateAnnotation}
                  onDelete={onDeleteAnnotation}
                />
              </div>
            ))}

            {postitAnnotations.map((ann) => (
              <div
                key={ann.id}
                className="pointer-events-auto"
                onClickCapture={(e) => {
                  if (activeTool === 'eraser') {
                    e.stopPropagation();
                    onDeleteAnnotation(ann.id);
                  }
                }}
              >
                <PostItWidget
                  annotation={ann}
                  pageWidth={dimensions.width}
                  pageHeight={dimensions.height}
                  zoom={zoom}
                  customHighlighters={customHighlighters}
                  isSelected={ann.id === selectedAnnotationId}
                  isFlashing={ann.id === flashingAnnotationId}
                  onSelect={onSelectAnnotation}
                  onUpdate={onUpdateAnnotation}
                  onDelete={onDeleteAnnotation}
                />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-zinc-300">
          Página {pageNumber}
        </div>
      )}
    </div>
  );
});

export default PdfPageCanvas;
