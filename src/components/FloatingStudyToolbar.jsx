import React from 'react';
import {
  MousePointer,
  Highlighter,
  StickyNote,
  Type,
  PenTool,
  Eraser,
  Undo2,
  Plus,
  X,
  Minus,
} from 'lucide-react';
import { POSTIT_COLORS, INK_COLORS, QUICK_COLOR_SWATCHES } from '../constants/studyTools';

const TOOLS = [
  { id: 'select', label: 'Mover / Editar', icon: MousePointer },
  { id: 'highlight', label: 'Marca-texto', icon: Highlighter },
  { id: 'postit', label: 'Post-it', icon: StickyNote },
  { id: 'text', label: 'Escrever', icon: Type },
  { id: 'pen', label: 'Caneta', icon: PenTool },
  { id: 'eraser', label: 'Apagar', icon: Eraser },
];

export default function FloatingStudyToolbar({
  activeTool,
  onSelectTool,
  toolOptions,
  onChangeToolOptions,
  customHighlighters,
  onUpdateCustomHighlighters,
  canUndo,
  onUndo,
}) {
  const activeHighlighter =
    customHighlighters.find((h) => h.id === toolOptions.activeHighlighterId) ||
    customHighlighters.find(
      (h) => h.hex.toLowerCase() === (toolOptions.highlightColor || '').toLowerCase()
    ) ||
    customHighlighters[0];

  const handleSelectHighlighter = (hl) => {
    onChangeToolOptions({
      activeHighlighterId: hl.id,
      highlightColor: hl.hex,
      studyTag: hl.tag,
    });
  };

  const handleEditActiveHighlighter = (patch) => {
    if (!activeHighlighter) return;
    const updatedList = customHighlighters.map((item) =>
      item.id === activeHighlighter.id ? { ...item, ...patch } : item
    );
    onUpdateCustomHighlighters(updatedList);
    onChangeToolOptions({
      activeHighlighterId: activeHighlighter.id,
      highlightColor: patch.hex ?? activeHighlighter.hex,
      studyTag: patch.tag ?? activeHighlighter.tag,
    });
  };

  const handleAddCustomHighlighter = () => {
    const usedHexes = customHighlighters.map((h) => h.hex.toLowerCase());
    const nextColor =
      QUICK_COLOR_SWATCHES.find((c) => !usedHexes.includes(c.toLowerCase())) || '#C084FC';
    const newItem = {
      id: `hl-${Date.now()}`,
      hex: nextColor,
      tag: 'Nova cor',
    };
    const updatedList = [...customHighlighters, newItem];
    onUpdateCustomHighlighters(updatedList);
    handleSelectHighlighter(newItem);
  };

  const handleDeleteHighlighter = (idToDelete) => {
    if (customHighlighters.length <= 1) return;
    const remaining = customHighlighters.filter((h) => h.id !== idToDelete);
    onUpdateCustomHighlighters(remaining);
    if (activeHighlighter?.id === idToDelete) {
      handleSelectHighlighter(remaining[0]);
    }
  };

  const currentThickness = toolOptions.highlightThickness || 0.014;

  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2 pointer-events-none max-w-[96vw]">
      {/* MARCA-TEXTO: Cores, Nome, Tamanho e Modo (Livre / Bloco / Reto) */}
      {activeTool === 'highlight' && activeHighlighter && (
        <div className="pointer-events-auto flex flex-col gap-2 bg-white px-4 py-2.5 rounded-2xl shadow-float border border-violet-100">
          {/* Linha 1: Suas cores + Escolher Cor e Nome */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
              {customHighlighters.map((hl) => {
                const isSelected = activeHighlighter.id === hl.id;
                return (
                  <div
                    key={hl.id}
                    onClick={() => handleSelectHighlighter(hl)}
                    className={`group flex items-center gap-1.5 pl-2.5 pr-2 py-1 rounded-xl text-xs cursor-pointer transition ${
                      isSelected
                        ? 'bg-violet-600 text-white font-medium shadow-sm'
                        : 'bg-[#F5F4F9] hover:bg-violet-50 text-zinc-700'
                    }`}
                  >
                    <span
                      style={{ backgroundColor: hl.hex }}
                      className="w-3.5 h-3.5 rounded-full border border-black/15 shrink-0"
                    />
                    <span className="max-w-[100px] truncate">{hl.tag || 'Sem nome'}</span>

                    {customHighlighters.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteHighlighter(hl.id);
                        }}
                        className={`p-0.5 rounded-full transition ${
                          isSelected
                            ? 'hover:bg-violet-700 text-violet-200 hover:text-white'
                            : 'opacity-40 group-hover:opacity-100 hover:bg-rose-100 text-rose-500'
                        }`}
                        title="Apagar esta cor"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={handleAddCustomHighlighter}
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-medium text-violet-600 bg-violet-50 hover:bg-violet-100 transition"
                title="Criar nova cor de marca-texto"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nova cor</span>
              </button>
            </div>

            <div className="hidden sm:block h-5 w-px bg-zinc-200" />

            {/* Seletor de Cor + Nome da Cor */}
            <div className="flex items-center gap-2">
              <label
                className="relative w-7 h-7 rounded-lg border border-zinc-200 cursor-pointer overflow-hidden shrink-0 shadow-sm"
                title="Clique para escolher a cor"
              >
                <input
                  type="color"
                  value={activeHighlighter.hex}
                  onChange={(e) => handleEditActiveHighlighter({ hex: e.target.value })}
                  className="absolute inset-0 w-10 h-10 -top-1 -left-1 cursor-pointer opacity-0"
                />
                <span
                  style={{ backgroundColor: activeHighlighter.hex }}
                  className="w-full h-full block"
                />
              </label>

              <input
                type="text"
                value={activeHighlighter.tag}
                onChange={(e) => handleEditActiveHighlighter({ tag: e.target.value })}
                placeholder="Nome da cor..."
                className="w-32 sm:w-36 px-2.5 py-1 rounded-xl text-xs bg-[#F5F4F9] border border-transparent focus:border-violet-400 focus:bg-white focus:outline-none text-zinc-800"
              />
            </div>
          </div>

          {/* Linha 2: Diminuir/Aumentar Tamanho do Marca-texto + Modo (Ir até a linha de baixo) */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1 border-t border-violet-50 text-xs">
            {/* Controle de Espessura / Tamanho */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-zinc-400">Tamanho:</span>
              <button
                type="button"
                onClick={() =>
                  onChangeToolOptions({
                    highlightThickness: Math.max(0.006, +(currentThickness - 0.003).toFixed(3)),
                  })
                }
                className="p-1 rounded-lg bg-[#F5F4F9] hover:bg-violet-50 text-zinc-700"
                title="Diminuir marca-texto"
              >
                <Minus className="w-3 h-3" />
              </button>

              <input
                type="range"
                min={0.006}
                max={0.04}
                step={0.002}
                value={currentThickness}
                onChange={(e) =>
                  onChangeToolOptions({ highlightThickness: parseFloat(e.target.value) })
                }
                className="w-20 accent-violet-600 cursor-pointer"
                title="Ajustar tamanho do marca-texto"
              />

              <button
                type="button"
                onClick={() =>
                  onChangeToolOptions({
                    highlightThickness: Math.min(0.04, +(currentThickness + 0.003).toFixed(3)),
                  })
                }
                className="p-1 rounded-lg bg-[#F5F4F9] hover:bg-violet-50 text-zinc-700"
                title="Aumentar marca-texto"
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>

            <div className="h-4 w-px bg-zinc-200" />

            {/* Modos: Reto / Várias linhas (Bloco) / Livre */}
            <div className="flex items-center gap-1 bg-[#F5F4F9] p-0.5 rounded-xl">
              {[
                { id: 'multiline', label: 'Linha / Descer p/ Baixo' },
                { id: 'free', label: 'Mão Livre' },
              ].map((mode) => {
                const activeMode = toolOptions.highlightMode || 'multiline';
                return (
                  <button
                    key={mode.id}
                    type="button"
                    onClick={() => onChangeToolOptions({ highlightMode: mode.id })}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition ${
                      activeMode === mode.id
                        ? 'bg-violet-600 text-white shadow-xs'
                        : 'text-zinc-600 hover:text-violet-900'
                    }`}
                  >
                    {mode.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* POST-IT Color Bar */}
      {activeTool === 'postit' && (
        <div className="pointer-events-auto flex items-center gap-2 bg-white px-3.5 py-2 rounded-2xl shadow-float border border-violet-100">
          <span className="text-xs text-zinc-400">Cor do Post-it:</span>
          {POSTIT_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onChangeToolOptions({ postitColor: c.hex })}
              style={{ backgroundColor: c.header }}
              className={`w-5 h-5 rounded-full border border-black/15 transition-transform ${
                toolOptions.postitColor === c.hex
                  ? 'scale-125 ring-2 ring-violet-600'
                  : 'hover:scale-110'
              }`}
              title={c.name}
            />
          ))}
        </div>
      )}

      {/* ESCREVER / CANETA Color Bar */}
      {(activeTool === 'text' || activeTool === 'pen') && (
        <div className="pointer-events-auto flex items-center gap-2 bg-white px-3.5 py-2 rounded-2xl shadow-float border border-violet-100">
          <span className="text-xs text-zinc-400">Cor:</span>
          {INK_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onChangeToolOptions({ inkColor: c.hex })}
              style={{ backgroundColor: c.hex }}
              className={`w-4 h-4 rounded-full transition-transform ${
                toolOptions.inkColor === c.hex
                  ? 'scale-125 ring-2 ring-violet-600'
                  : 'hover:scale-110'
              }`}
              title={c.name}
            />
          ))}
        </div>
      )}

      {/* Main Bottom Tool Bar */}
      <div className="pointer-events-auto flex items-center gap-1 bg-white p-1.5 rounded-2xl shadow-float border border-violet-100">
        {TOOLS.map((tool) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              type="button"
              onClick={() => onSelectTool(tool.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-zinc-600 hover:bg-violet-50 hover:text-violet-900'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tool.label}</span>
            </button>
          );
        })}

        {canUndo && (
          <>
            <div className="h-4 w-px bg-zinc-200 mx-1" />
            <button
              type="button"
              onClick={onUndo}
              className="p-2 rounded-xl text-zinc-500 hover:bg-violet-50 hover:text-violet-900 transition"
              title="Desfazer última ação"
            >
              <Undo2 className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
