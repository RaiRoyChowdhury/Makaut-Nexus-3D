import { Activity, ArrowRight, Eye, Layers } from "lucide-react";
import { VisualState } from "../../../types/logicMorph";

interface AlgorithmVisualizer2DProps {
  visualState: VisualState | undefined;
  algorithmName: string;
}

function ArrayAndPointerView({ visualState }: { visualState: VisualState }) {
  const arr = visualState.array ?? [];
  const pointers = visualState.pointers ?? {};
  const eliminated = new Set(visualState.eliminatedIndices ?? []);
  const highlighted = new Set(visualState.highlightIndices ?? []);
  const winRange = visualState.windowRange;

  if (arr.length === 0) {
    return (
      <p className="text-xs text-[#94A3B8] py-4 text-center">
        No array elements provided for this step.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {visualState.target !== undefined && (
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-[#94A3B8]">
            {visualState.mode === "sliding_window"
              ? "Active Window"
              : visualState.mode === "string"
              ? "Character Buffer"
              : "Target Value"}
          </span>
          <span className="text-[#00F5D4] font-bold">
            {visualState.mode === "sliding_window" && winRange
              ? `[${winRange[0]}..${winRange[1]}]`
              : `target = ${visualState.target}`}
          </span>
        </div>
      )}

      {/* Array / Char Cells with Pointer Markers */}
      <div className="flex flex-wrap gap-2 pt-1">
        {arr.map((val, idx) => {
          const isEliminated = eliminated.has(idx);
          const isHighlighted = highlighted.has(idx);
          const inWindow =
            winRange !== undefined && idx >= winRange[0] && idx <= winRange[1];

          const pointerNames = Object.entries(pointers)
            .filter(([, pIdx]) => Number(pIdx) === idx)
            .map(([name]) => name);

          return (
            <div
              key={`${idx}-${String(val)}`}
              className="flex flex-col items-center gap-1 min-w-[44px]"
            >
              {/* Pointer Tags Above Cell */}
              <div className="h-5 flex items-center justify-center gap-1">
                {pointerNames.map((pName) => (
                  <span
                    key={pName}
                    title={`Pointer ${pName} at index ${idx}`}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-transform duration-200 motion-reduce:transition-none ${
                      pName === "mid"
                        ? "bg-[#8B5CF6] text-white"
                        : pName === "right"
                        ? "bg-[#F59E0B] text-[#06080E]"
                        : "bg-[#00F5D4] text-[#06080E]"
                    }`}
                  >
                    {pName === "left" ? "L" : pName === "right" ? "R" : pName === "mid" ? "M" : pName}
                  </span>
                ))}
              </div>

              {/* Array Element Cell */}
              <div
                className={`w-11 h-11 rounded-xl border flex items-center justify-center font-mono text-sm font-bold tabular-nums transition-all duration-200 motion-reduce:transition-none ${
                  isHighlighted
                    ? "bg-[#00F5D4]/20 border-[#00F5D4] text-[#F4F7FB] scale-105"
                    : inWindow
                    ? "bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#F4F7FB]"
                    : isEliminated
                    ? "bg-[#070A11] border-white/[0.04] text-[#475569] opacity-45"
                    : "bg-[#0B101B] border-white/[0.12] text-[#CBD5E1]"
                }`}
              >
                {String(val)}
              </div>

              {/* Index Label */}
              <span className="text-[10px] font-mono text-[#64748B] tabular-nums">
                {idx}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LinkedListView({ visualState }: { visualState: VisualState }) {
  const nodes = visualState.nodes ?? [];
  return (
    <div className="flex flex-wrap items-center gap-2 py-2">
      {nodes.map((node, i) => (
        <div key={node.id} className="flex items-center gap-2">
          <div
            className={`rounded-xl border px-3 py-2 flex items-center gap-2 font-mono text-xs transition-all duration-200 motion-reduce:transition-none ${
              node.active
                ? "bg-[#00F5D4]/18 border-[#00F5D4] text-[#F4F7FB]"
                : node.visited
                ? "bg-[#8B5CF6]/18 border-[#8B5CF6]/60 text-[#DDD6FE]"
                : "bg-[#0B101B] border-white/10 text-[#CBD5E1]"
            }`}
          >
            <span className="font-bold">{node.label}</span>
            <span className="text-[10px] text-[#64748B] border-l border-white/10 pl-2">
              {node.next ? `→ ${node.next}` : "→ null"}
            </span>
          </div>
          {i < nodes.length - 1 && (
            <ArrowRight className="w-3.5 h-3.5 text-[#00F5D4] shrink-0" />
          )}
        </div>
      ))}
      <span className="text-xs font-mono text-[#64748B] px-2">NULL</span>
    </div>
  );
}

function RecursionStackView({ visualState }: { visualState: VisualState }) {
  const frames = visualState.stackFrames ?? [];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-mono text-[#94A3B8]">
        <span>Call Stack (Top = Active Frame)</span>
        <span>{frames.length} frames</span>
      </div>
      <div className="flex flex-col-reverse gap-1.5">
        {frames.map((frame, i) => (
          <div
            key={`${frame.fn}-${frame.params}-${i}`}
            className={`rounded-xl border px-3 py-2 flex items-center justify-between gap-2 font-mono text-xs transition-all duration-200 motion-reduce:transition-none ${
              frame.state === "base" || frame.state === "active"
                ? "bg-[#00F5D4]/15 border-[#00F5D4] text-[#F4F7FB]"
                : frame.state === "returning"
                ? "bg-[#10B981]/15 border-[#10B981]/60 text-[#A7F3D0]"
                : "bg-[#0B101B] border-white/10 text-[#94A3B8]"
            }`}
          >
            <span className="truncate">
              {frame.fn}({frame.params})
            </span>
            <span className="text-[11px] shrink-0">
              {frame.returnVal ? `returns ${frame.returnVal}` : frame.state}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TreeGraphView({ visualState }: { visualState: VisualState }) {
  const nodes = visualState.nodes ?? [];
  const edges = visualState.edges ?? [];
  const w = 320;
  const h = 165;

  const positioned = nodes.map((n, idx) => {
    if (typeof n.x === "number" && typeof n.y === "number") {
      return { ...n, cx: n.x, cy: n.y };
    }
    if (visualState.mode === "tree") {
      // Binary tree heuristic positioning
      const level = Math.floor(Math.log2(idx + 1));
      const posInLevel = idx - (Math.pow(2, level) - 1);
      const countInLevel = Math.pow(2, level);
      const cx = ((posInLevel + 0.5) / countInLevel) * (w - 40) + 20;
      const cy = 28 + level * 46;
      return { ...n, cx, cy };
    }
    const angle = (idx / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
    return {
      ...n,
      cx: w / 2 + Math.cos(angle) * 95,
      cy: h / 2 + Math.sin(angle) * 56,
    };
  });

  const posMap = new Map(positioned.map((p) => [p.id, p]));

  return (
    <div className="space-y-2">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-40 rounded-xl bg-[#070A11] border border-white/[0.06]"
        role="img"
        aria-label="Tree or Graph traversal diagram"
      >
        {edges.map((edge, idx) => {
          const from = posMap.get(edge.from);
          const to = posMap.get(edge.to);
          if (!from || !to) return null;
          return (
            <line
              key={idx}
              x1={from.cx}
              y1={from.cy}
              x2={to.cx}
              y2={to.cy}
              stroke={edge.active ? "#00F5D4" : "#334155"}
              strokeWidth={edge.active ? 2.5 : 1.5}
            />
          );
        })}
        {positioned.map((node) => (
          <g key={node.id}>
            <circle
              cx={node.cx}
              cy={node.cy}
              r={16}
              fill={
                node.active
                  ? "#00F5D4"
                  : node.visited
                  ? "#8B5CF6"
                  : "#111624"
              }
              stroke={node.active ? "#FFFFFF" : "#475569"}
              strokeWidth={1.5}
            />
            <text
              x={node.cx}
              y={node.cy + 4}
              textAnchor="middle"
              fontSize="11"
              fontWeight="bold"
              fill={node.active ? "#06080E" : "#F4F7FB"}
              fontFamily="JetBrains Mono, monospace"
            >
              {node.label.slice(0, 4)}
            </text>
          </g>
        ))}
      </svg>
      {visualState.frontier && visualState.frontier.length > 0 && (
        <div className="text-[11px] font-mono text-[#94A3B8]">
          Frontier / Queue: <span className="text-[#00F5D4]">[{visualState.frontier.join(", ")}]</span>
        </div>
      )}
    </div>
  );
}

function DpTableView({ visualState }: { visualState: VisualState }) {
  const cells = visualState.dpCells ?? [];
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-mono text-[#94A3B8]">DP State Table</p>
      <div className="flex flex-wrap gap-2">
        {cells.map((cell) => (
          <div
            key={cell.label}
            className={`min-w-[54px] rounded-xl border p-2 text-center font-mono transition-all duration-200 motion-reduce:transition-none ${
              cell.active
                ? "bg-[#00F5D4]/20 border-[#00F5D4] text-[#F4F7FB]"
                : cell.isSource
                ? "bg-[#8B5CF6]/20 border-[#8B5CF6] text-[#DDD6FE]"
                : "bg-[#0B101B] border-white/10 text-[#CBD5E1]"
            }`}
          >
            <span className="block text-[10px] text-[#94A3B8]">{cell.label}</span>
            <span className="block text-sm font-bold tabular-nums mt-0.5">
              {String(cell.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AlgorithmVisualizer2D({
  visualState,
  algorithmName,
}: AlgorithmVisualizer2DProps) {
  if (!visualState) return null;

  const vars = visualState.variables ?? {};
  const varEntries = Object.entries(vars);

  return (
    <div className="nexus-panel rounded-2xl p-4 lg:p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-[#F4F7FB] inline-flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#8B5CF6]" />
          2D Visual State
        </h3>
        <span className="text-[11px] font-mono text-[#94A3B8]">
          {visualState.mode.replace("_", " ")} · {algorithmName}
        </span>
      </div>

      {/* Category-Appropriate 2D Stage */}
      <div className="rounded-xl bg-[#070A11] border border-white/[0.08] p-3.5">
        {(visualState.mode === "array" ||
          visualState.mode === "two_pointers" ||
          visualState.mode === "sliding_window" ||
          visualState.mode === "string") &&
          Array.isArray(visualState.array) &&
          visualState.array.length > 0 && (
            <ArrayAndPointerView visualState={visualState} />
          )}

        {visualState.mode === "linked_list" &&
          Array.isArray(visualState.nodes) &&
          visualState.nodes.length > 0 && <LinkedListView visualState={visualState} />}

        {(visualState.mode === "recursion" || visualState.mode === "stack") &&
          Array.isArray(visualState.stackFrames) &&
          visualState.stackFrames.length > 0 && (
            <RecursionStackView visualState={visualState} />
          )}

        {(visualState.mode === "tree" || visualState.mode === "graph") &&
          Array.isArray(visualState.nodes) &&
          visualState.nodes.length > 0 && <TreeGraphView visualState={visualState} />}

        {visualState.mode === "dp" &&
          Array.isArray(visualState.dpCells) &&
          visualState.dpCells.length > 0 && <DpTableView visualState={visualState} />}

        {/* Variable / State Fallback when mode is "variables" or collection data is empty */}
        {(visualState.mode === "variables" ||
          (!visualState.array?.length &&
            !visualState.nodes?.length &&
            !visualState.stackFrames?.length &&
            !visualState.dpCells?.length)) && (
          <div className="py-2 flex items-center gap-2.5 text-xs text-[#CBD5E1]">
            <Layers className="w-4 h-4 text-[#00F5D4] shrink-0" />
            <span>{visualState.callOrStateNote}</span>
          </div>
        )}
      </div>

      {/* Live Variable State Strip */}
      {varEntries.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[11px] font-mono text-[#94A3B8] inline-flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#00F5D4]" />
            Live Variable Registers
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 font-mono text-xs tabular-nums">
            {varEntries.map(([k, v]) => (
              <div
                key={k}
                className="rounded-lg bg-[#090C14] border border-white/[0.07] px-2.5 py-1.5 flex items-center justify-between gap-2"
              >
                <span className="text-[#94A3B8] truncate">{k}</span>
                <span className="text-[#00F5D4] font-bold truncate">{String(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* State Narration Callout */}
      <p className="text-xs text-[#CBD5E1] leading-relaxed bg-[#090C14] border border-white/[0.06] rounded-xl px-3 py-2.5">
        {visualState.callOrStateNote}
      </p>
    </div>
  );
}
