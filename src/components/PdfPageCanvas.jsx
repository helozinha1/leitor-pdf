import React, { useEffect, useRef, useState, useCallback, memo } from 'react';
import { Trash2, Minus, Plus, Ruler, Sparkles } from 'lucide-react';
import PostItWidget from './PostItWidget';
import { TextAnnotationWidget, StampAnnotationWidget } from './PageOverlayWidgets';
import { POSTIT_COLORS, STAMP_TYPES } from '../constants/studyTools';

// Render points as smooth Quadratic Bezier SVG path when smoothed, or standard polyline
function pointsToSvgPath(points, useSmoothBezier = false) {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    const x = (points[0].x * 1000).toFixed(1);
    const y = (points[0].y * 1000).toFixed(1);
    return `M ${x} ${y} L ${x} ${y}`;
  }
  if (!useSmoothBezier || points.length === 2) {
    return points
      .map(
        (pt, idx) =>
          `${idx === 0 ? 'M' : 'L'} ${(pt.x * 1000).toFixed(1)} ${(pt.y * 1000).toFixed(1)}`
      )
      .join(' ');
  }

  // Smooth Quadratic Bezier curve through midpoints for calligraphic handwriting
  let d = `M ${(points[0].x * 1000).toFixed(1)} ${(points[0].y * 1000).toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const curr = points[i];
    const next = points[i + 1];
    const midX = (((curr.x + next.x) / 2) * 1000).toFixed(1);
    const midY = (((curr.y + next.y) / 2) * 1000).toFixed(1);
    d += ` Q ${(curr.x * 1000).toFixed(1)} ${(curr.y * 1000).toFixed(1)}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${(last.x * 1000).toFixed(1)} ${(last.y * 1000).toFixed(1)}`;
  return d;
}

// Snap a straight line to horizontal or vertical if nearly aligned
function snapStraightEndpoints(startPt, endPt) {
  const dx = endPt.x - startPt.x;
  const dy = endPt.y - startPt.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx > 0.02 && absDy / absDx < 0.08) {
    return [startPt, { x: endPt.x, y: startPt.y }];
  }
  if (absDy > 0.02 && absDx / absDy < 0.08) {
    return [startPt, { x: startPt.x, y: endPt.y }];
  }
  return [startPt, endPt];
}

// Beautify / Smooth shaky mouse handwriting (Chaikin smoothing + straight-line detection)
function beautifyStrokePoints(rawPoints) {
  if (!rawPoints || rawPoints.length <= 2) return rawPoints;

  // 1. Filter out tiny micro-jitter points from mouse movement
  const filtered = [rawPoints[0]];
  for (let i = 1; i < rawPoints.length; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = rawPoints[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= 0.0025 || i === rawPoints.length - 1) {
      filtered.push(curr);
    }
  }

  if (filtered.length <= 2) {
    return snapStraightEndpoints(filtered[0], filtered[filtered.length - 1]);
  }

  // 2. Check if the user intended a straight line (e.g. underline, fraction bar, stem)
  const start = filtered[0];
  const end = filtered[filtered.length - 1];
  const chordLen = Math.hypot(end.x - start.x, end.y - start.y);

  if (chordLen > 0.025) {
    let maxDev = 0;
    for (let i = 1; i < filtered.length - 1; i++) {
      const p = filtered[i];
      const num = Math.abs(
        (end.y - start.y) * p.x - (end.x - start.x) * p.y + end.x * start.y - end.y * start.x
      );
      const dev = num / chordLen;
      if (dev > maxDev) maxDev = dev;
    }
    if (maxDev / chordLen < 0.055) {
      return snapStraightEndpoints(start, end);
    }
  }

  // 3. Apply 2 passes of Chaikin's corner-cutting algorithm to round out shaky corners
  let pts = filtered;
  for (let pass = 0; pass < 2; pass++) {
    if (pts.length < 3) break;
    const next = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      next.push({
        x: 0.75 * p0.x + 0.25 * p1.x,
        y: 0.75 * p0.y + 0.25 * p1.y,
      });
      next.push({
        x: 0.25 * p0.x + 0.75 * p1.x,
        y: 0.25 * p0.y + 0.75 * p1.y,
      });
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }

  return pts;
}

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
  const [resizingHandle, setResizingHandle] = useState(null);

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
        straight: !!toolOptions.penStraight,
        beautify: !!toolOptions.penBeautify,
        color: toolOptions.inkColor || '#6D28D9',
        strokeWidth: toolOptions.penThickness || 0.0032,
        points: [pt],
      });
    }
  };

  const handleMouseMove = (e) => {
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

    if (!draftStroke) return;
    const pt = getNormalizedCoords(e.clientX, e.clientY);

    if (draftStroke.type === 'highlight' && draftStroke.mode !== 'free') {
      const startPt = draftStroke.points[0];
      const dy = Math.abs(pt.y - startPt.y);
      const targetY = dy < 0.009 ? startPt.y : pt.y;
      setDraftStroke((prev) => ({
        ...prev,
        points: [startPt, { x: pt.x, y: targetY }],
      }));
      return;
    }

    // Pen with "Traço Reto" activated (or holding Shift)
    if (draftStroke.type === 'pen' && (draftStroke.straight || e.shiftKey)) {
      const startPt = draftStroke.points[0];
      const snapped = snapStraightEndpoints(startPt, pt);
      setDraftStroke((prev) => ({
        ...prev,
        points: snapped,
      }));
      return;
    }

    // Pen with "Arrumar Letra" activated: stabilize hand tremor in real-time
    if (draftStroke.type === 'pen' && draftStroke.beautify) {
      setDraftStroke((prev) => {
        const last = prev.points[prev.points.length - 1];
        const stabilized = {
          x: last.x * 0.45 + pt.x * 0.55,
          y: last.y * 0.45 + pt.y * 0.55,
        };
        return {
          ...prev,
          points: [...prev.points, stabilized],
        };
      });
      return;
    }

    setDraftStroke((prev) => ({
      ...prev,
      points: [...prev.points, pt],
    }));
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

    let finalPoints = draftStroke.points;
    if (finalPoints.length >= 2) {
      const dx = finalPoints[finalPoints.length - 1].x - finalPoints[0].x;
      const dy = finalPoints[finalPoints.length - 1].y - finalPoints[0].y;
      const dist = Math.hypot(dx, dy);

      if (dist > 0.004 || finalPoints.length > 4) {
        // Only apply beautification when "Arrumar Letra" is explicitly activated!
        const isSmoothed =
          draftStroke.type === 'pen' && !!draftStroke.beautify;
        if (isSmoothed && !draftStroke.straight) {
          finalPoints = beautifyStrokePoints(finalPoints);
        }

        const snippet =
          draftStroke.type === 'highlight' ? extractHighlightedSnippet(finalPoints) : '';

        onCreateAnnotation({
          page: pageNumber,
          type: draftStroke.type,
          mode: draftStroke.mode || 'multiline',
          smoothed: isSmoothed,
          color: draftStroke.color,
          tag: draftStroke.tag || 'Marca-texto',
          opacity: draftStroke.opacity || 0.42,
          strokeWidth: draftStroke.strokeWidth,
          points: finalPoints,
          label:
            snippet ||
            (draftStroke.type === 'highlight'
              ? `${draftStroke.tag || 'Marcação'}`
              : 'Escrita'),
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
          <canvas
            ref={canvasRef}
            className="block pointer-events-none rounded-xl"
          />

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
                (ann.strokeWidth || (isHighlight ? 0.014 : 0.0032)) * 1000;

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

                    {isSelected && (
                      <>
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

              const isStraightPen =
                !isHighlight && ann.points && ann.points.length === 2;

              return (
                <g key={ann.id}>
                  {isSelected && (
                    <path
                      d={pointsToSvgPath(ann.points, !!ann.smoothed)}
                      fill="none"
                      stroke="#7C3AED"
                      strokeWidth={strokeWidthSvg + 5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.4}
                    />
                  )}
                  <path
                    d={pointsToSvgPath(ann.points, !!ann.smoothed)}
                    fill="none"
                    stroke={ann.color || '#FDE047'}
                    strokeWidth={strokeWidthSvg}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={isHighlight ? ann.opacity || 0.42 : 0.94}
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

                  {/* Endpoint handles for straight pen lines */}
                  {isSelected && isStraightPen && (
                    <>
                      <circle
                        cx={ann.points[0].x * 1000}
                        cy={ann.points[0].y * 1000}
                        r={6}
                        fill="#7C3AED"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                        style={{ pointerEvents: 'all', cursor: 'move' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setResizingHandle({ annId: ann.id, which: 'start' });
                        }}
                      />
                      <circle
                        cx={ann.points[1].x * 1000}
                        cy={ann.points[1].y * 1000}
                        r={6}
                        fill="#7C3AED"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                        style={{ pointerEvents: 'all', cursor: 'move' }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          setResizingHandle({ annId: ann.id, which: 'end' });
                        }}
                      />
                    </>
                  )}
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
                  d={pointsToSvgPath(draftStroke.points, !!draftStroke.beautify)}
                  fill="none"
                  stroke={draftStroke.color}
                  strokeWidth={draftStroke.strokeWidth * 1000}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={draftStroke.type === 'highlight' ? 0.42 : 0.92}
                  style={{
                    mixBlendMode:
                      draftStroke.type === 'highlight' ? 'multiply' : 'normal',
                  }}
                />
              ))}
          </svg>

          {/* Popover when a Highlight or Pen Stroke is clicked */}
          {selectedVector && (
            <div
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                left: `${Math.min(0.48, selectedVector.points?.[0]?.x || 0.2) * dimensions.width}px`,
                top: `${Math.max(0.02, (selectedVector.points?.[0]?.y || 0.2) - 0.055) * dimensions.height}px`,
              }}
              className="absolute z-50 flex items-center gap-2 bg-white text-zinc-800 px-3 py-1.5 rounded-2xl shadow-float border border-violet-100 text-xs"
            >
              {/* On-demand "Traço Reto" and "Arrumar Traço" buttons for a selected Pen stroke */}
              {selectedVector.type === 'pen' && selectedVector.points?.length >= 2 && (
                <div className="flex items-center gap-1 pr-1 border-r border-zinc-200">
                  <button
                    type="button"
                    onClick={() => {
                      const pts = selectedVector.points;
                      const straightPts = snapStraightEndpoints(
                        pts[0],
                        pts[pts.length - 1]
                      );
                      onUpdateAnnotation(
                        selectedVector.id,
                        { points: straightPts, smoothed: false },
                        true
                      );
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-xl bg-[#F5F4F9] hover:bg-violet-50 text-violet-900 font-medium transition"
                    title="Transformar este traço em uma linha reta"
                  >
                    <Ruler className="w-3.5 h-3.5 text-violet-600" />
                    <span>Deixar Reto</span>
                  </button>

                  {selectedVector.points.length > 2 && (
                    <button
                      type="button"
                      onClick={() => {
                        const smoothedPts = beautifyStrokePoints(selectedVector.points);
                        onUpdateAnnotation(
                          selectedVector.id,
                          { points: smoothedPts, smoothed: true },
                          true
                        );
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-xl bg-[#F5F4F9] hover:bg-violet-50 text-violet-900 font-medium transition"
                      title="Suavizar e arrumar este traço"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                      <span>Arrumar</span>
                    </button>
                  )}
                </div>
              )}

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
