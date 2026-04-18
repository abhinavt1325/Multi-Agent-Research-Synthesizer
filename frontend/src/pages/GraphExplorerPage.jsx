import { useEffect, useRef, useState } from "react";
import { fetchGraphData, deletePaper } from "../services/dashboard";
import { useAuth } from "../hooks/useAuth";

const GRAPH_WIDTH = 1100;
const GRAPH_HEIGHT = 720;
const LABEL_ORDER = ["User", "Topic", "Paper", "Method", "Dataset", "Gap"];

// Premium semantic color palette
const LABEL_STYLES = {
  User: {
    fill: "#db2777", // Magenta
    stroke: "#f472b6",
    text: "#ffffff",
    radius: 24,
    anchor: { x: 550, y: 360 },
    glow: "rgba(219, 39, 119, 0.4)",
  },
  Topic: {
    fill: "#0891b2", // Cyan
    stroke: "#22d3ee",
    text: "#ffffff",
    radius: 20,
    anchor: { x: 550, y: 120 },
    glow: "rgba(8, 145, 178, 0.4)",
  },
  Paper: {
    fill: "#7c3aed", // Violet
    stroke: "#a78bfa",
    text: "#ffffff",
    radius: 16,
    anchor: { x: 860, y: 260 },
    glow: "rgba(124, 58, 237, 0.4)",
  },
  Method: {
    fill: "#d97706", // Amber
    stroke: "#fbbf24",
    text: "#ffffff",
    radius: 15,
    anchor: { x: 760, y: 560 },
    glow: "rgba(217, 119, 6, 0.4)",
  },
  Dataset: {
    fill: "#059669", // Green
    stroke: "#34d399",
    text: "#ffffff",
    radius: 15,
    anchor: { x: 340, y: 560 },
    glow: "rgba(5, 150, 105, 0.4)",
  },
  Gap: {
    fill: "#ea580c", // Orange
    stroke: "#fb923c",
    text: "#ffffff",
    radius: 16,
    anchor: { x: 240, y: 260 },
    glow: "rgba(234, 88, 12, 0.4)",
  },
};

function formatLabelKey(key) {
  // Common paper properties cleanup
  if (key === "paper_id") return "Paper ID";
  if (key === "publication_year") return "Year";
  if (key === "citation_count") return "Citations";
  
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function getNodeLabel(node) {
  return LABEL_ORDER.includes(node.label) ? node.label : "Paper";
}

function buildGraphLayout(graphData) {
  const nodes = Array.isArray(graphData?.nodes) ? graphData.nodes : [];
  const edges = Array.isArray(graphData?.edges) ? graphData.edges : [];
  const groupedNodes = {};

  LABEL_ORDER.forEach((label) => {
    groupedNodes[label] = [];
  });

  nodes.forEach((node) => {
    const label = getNodeLabel(node);
    groupedNodes[label].push(node);
  });

  const positionedNodes = [];
  const nodeMap = {};

  LABEL_ORDER.forEach((label) => {
    const group = groupedNodes[label];
    const style = LABEL_STYLES[label];
    const orbitRadius = Math.max(48, Math.min(180, 40 + group.length * 12));

    group.forEach((node, index) => {
      const angle = group.length === 1 ? -Math.PI / 2 : (Math.PI * 2 * index) / group.length - Math.PI / 2;
      const position = {
        ...node,
        display_name: String(node.display_name || node.node_id || "Unnamed Node"),
        x: style.anchor.x + Math.cos(angle) * orbitRadius,
        y: style.anchor.y + Math.sin(angle) * orbitRadius,
        style,
      };

      positionedNodes.push(position);
      nodeMap[node.node_id] = position;
    });
  });

  const positionedEdges = edges
    .map((edge) => ({
      ...edge,
      source: nodeMap[edge.source_id],
      target: nodeMap[edge.target_id],
    }))
    .filter((edge) => edge.source && edge.target);

  return { nodes: positionedNodes, edges: positionedEdges };
}

function GraphExplorerPage() {
  const { userEmail } = useAuth();
  const graphContainerRef = useRef(null);
  const [graphData, setGraphData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 });
  const [dragState, setDragState] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    let isActive = true;

    async function loadGraphExplorer() {
      setStatus("loading");
      setError("");

      try {
        const graphResponse = await fetchGraphData(userEmail);

        if (!isActive) {
          return;
        }

        setGraphData(graphResponse);
        setStatus(graphResponse.status === "ok" ? "success" : graphResponse.status || "success");
        setSelectedNodeId(graphResponse.nodes?.[0]?.node_id || "");
      } catch (requestError) {
        if (!isActive) {
          return;
        }

        setGraphData(null);
        setStatus("error");
        setError(requestError.message || "Unable to load graph explorer data.");
      }
    }

    loadGraphExplorer();

    return () => {
      isActive = false;
    };
  }, [userEmail]);

  const graphLayout = buildGraphLayout(graphData);
  const selectedNode = graphLayout.nodes.find((node) => node.node_id === selectedNodeId) || graphLayout.nodes[0] || null;

  function updateZoom(nextScale) {
    setViewport((current) => ({
      ...current,
      scale: Math.min(2.25, Math.max(0.55, nextScale)),
    }));
  }

  function handleWheel(event) {
    event.preventDefault();
    const delta = event.deltaY > 0 ? -0.08 : 0.08;
    updateZoom(viewport.scale + delta);
  }

  const handleDeleteNode = async () => {
    if (!selectedNode || selectedNode.label !== "Paper") return;

    // Use stable paper_id from node details
    const paperId = selectedNode?.details?.paper_id;
    if (!paperId) {
      alert("Cannot delete: this Paper node does not have a stable paper_id.");
      return;
    }

    if (!window.confirm("Remove this paper from your research memory?")) return;

    try {
      await deletePaper(paperId, userEmail);

      // Clear selection immediately to avoid stale UI state
      setSelectedNodeId("");

      // Refresh the graph data to reflect the deletion
      const newGraphData = await fetchGraphData(userEmail);
      setGraphData(newGraphData);
    } catch (e) {
      console.error("Failed to delete paper", e);
      alert(e.message || "Failed to delete paper");
    }
  };

  function handlePointerDown(event) {
    if (event.target.closest("[data-node-interactive='true']")) {
      return;
    }

    setDragState({
      x: event.clientX,
      y: event.clientY,
      originX: viewport.x,
      originY: viewport.y,
    });
  }

  function handleSvgMouseMove(event) {
    setMousePos({ x: event.clientX, y: event.clientY });
    if (!dragState) {
      return;
    }

    setViewport((current) => ({
      ...current,
      x: dragState.originX + (event.clientX - dragState.x),
      y: dragState.originY + (event.clientY - dragState.y),
    }));
  }

  function handlePointerUp() {
    setDragState(null);
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8">
      <section className="overflow-hidden rounded-[32px] border border-line bg-panel text-ink shadow-panel">
        <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-10">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">Shared Graph Intelligence</p>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Graph Explorer</h1>
              <p className="max-w-2xl text-sm leading-7 text-muted sm:text-base">
                Inspect live Neo4j nodes for users, topics, papers, methods, datasets, and gaps from one interactive canvas.
                Zoom the graph, pan across clusters, and click any node to inspect its actual stored properties.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-line bg-canvas/30 p-5 shadow-panel-soft backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Graph Status</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-ink capitalize">{status}</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              {error || graphData?.detail || "Loading graph-backed data from the backend."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">
              <span className="rounded-full border border-line bg-canvas/50 px-3 py-2">Zoom</span>
              <span className="rounded-full border border-line bg-canvas/50 px-3 py-2">Pan</span>
              <span className="rounded-full border border-line bg-canvas/50 px-3 py-2">Node Details</span>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <article className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Topics</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-ink">{graphData?.topics_count ?? "Unavailable"}</p>
        </article>
        <article className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Papers</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-ink">{graphData?.papers_count ?? "Unavailable"}</p>
        </article>
        <article className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Methods</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-ink">{graphData?.methods_count ?? "Unavailable"}</p>
        </article>
        <article className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Datasets</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-ink">{graphData?.datasets_count ?? "Unavailable"}</p>
        </article>
        <article className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Gaps</p>
          <p className="mt-3 text-4xl font-semibold tracking-tight text-ink">{graphData?.gaps_count ?? "Unavailable"}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.6fr_0.8fr]">
        <article className="rounded-[28px] border border-line bg-panel/95 p-5 shadow-panel-soft">
          <div className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Interactive Graph</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">Live Neo4j topology</h2>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                <span className="h-2 w-2 rounded-full bg-accent animate-pulse" />
                Live Connection
              </span>
            </div>
          </div>


          {graphLayout.nodes.length ? (
            <div
              ref={graphContainerRef}
              className={`group overflow-hidden bg-[#050810] transition-all duration-500 ease-in-out ${
                isFullscreen
                  ? "fixed inset-0 z-[100] flex animate-in zoom-in-95"
                  : "relative mt-5 rounded-[24px] border border-white/5 shadow-inner"
              }`}
              onWheel={handleWheel}
              onMouseMove={handleSvgMouseMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
            >
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-900/10 via-transparent to-transparent" />
              
              {/* Floating Graph Toolbar */}
              <div className="absolute bottom-6 right-6 z-10 flex items-center gap-3 rounded-[24px] border border-line bg-panel/90 p-3 shadow-2xl backdrop-blur-md transition-all group-hover:bg-panel">
                <div className="flex items-center gap-2 border-r border-white/10 pr-3">
                  <button
                    type="button"
                    onClick={() => updateZoom(viewport.scale - 0.1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white transition hover:bg-white/10 active:scale-95"
                    title="Zoom Out"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                  
                  <div className="flex flex-col items-center px-2">
                    <input
                      type="range"
                      min="0.55"
                      max="2.25"
                      step="0.05"
                      value={viewport.scale}
                      onChange={(e) => updateZoom(parseFloat(e.target.value))}
                      className="h-1.5 w-24 cursor-pointer appearance-none rounded-full bg-white/10 accent-indigo-500 hover:bg-white/20"
                    />
                    <span className="mt-1 text-[10px] font-bold text-white/50 tabular-nums">
                      {Math.round(viewport.scale * 100)}%
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => updateZoom(viewport.scale + 0.1)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 text-white transition hover:bg-white/10 active:scale-95"
                    title="Zoom In"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setViewport({ scale: 1, x: 0, y: 0 })}
                  className="flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-[11px] font-bold text-white transition hover:bg-indigo-500 active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                  RESET
                </button>
                <div className="mx-1 h-6 w-px bg-white/10" />
                <button
                  type="button"
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 text-[11px] font-bold text-white transition hover:bg-white/10 active:scale-95"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    {isFullscreen ? (
                       <path d="M8 3v3h-3m16 0h-3v-3m0 18v-3h3m-16 0h3v3"/>
                    ) : (
                       <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/>
                    )}
                  </svg>
                  {isFullscreen ? "EXIT" : "FULLSCREEN"}
                </button>
              </div>

              <svg
                viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                className={`w-full ${isFullscreen ? "h-screen" : "h-[560px]"} ${dragState ? "cursor-grabbing" : "cursor-grab"}`}
                onMouseDown={handlePointerDown}
              >
                <style>
                  {`
                    @keyframes softPulse {
                      0% { filter: drop-shadow(0 0 4px var(--glow-color)); transform: scale(1); }
                      50% { filter: drop-shadow(0 0 12px var(--glow-color)); transform: scale(1.04); }
                      100% { filter: drop-shadow(0 0 4px var(--glow-color)); transform: scale(1); }
                    }
                    @keyframes edgeFlow {
                      to { stroke-dashoffset: -20; }
                    }
                    .node-anim {
                      transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
                    }
                    .node-hovered {
                      animation: softPulse 2s infinite ease-in-out;
                      z-index: 10;
                    }
                    .edge-active {
                      animation: edgeFlow 1s linear infinite;
                      stroke: rgba(255, 255, 255, 0.6);
                      stroke-dasharray: 4 6;
                    }
                    .edge-inactive {
                      stroke: rgba(255, 255, 255, 0.03);
                    }
                    .edge-default {
                      stroke: rgba(255, 255, 255, 0.12);
                    }
                  `}
                </style>
                <defs>
                  <pattern id="graph-grid" width="40" height="40" patternUnits="userSpaceOnUse">
                    <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="1" />
                  </pattern>
                  <filter id="nodeShadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#000000" floodOpacity="0.5" />
                  </filter>
                  {Object.keys(LABEL_STYLES).map(label => {
                    const style = LABEL_STYLES[label];
                    return (
                      <radialGradient key={`grad-${label}`} id={`grad-${label}`} cx="30%" cy="30%" r="70%">
                        <stop offset="0%" stopColor="#ffffff" stopOpacity="0.4" />
                        <stop offset="25%" stopColor={style.fill} stopOpacity="1" />
                        <stop offset="100%" stopColor={style.stroke} stopOpacity="1" />
                      </radialGradient>
                    );
                  })}
                </defs>
                <rect width="100%" height="100%" fill="url(#graph-grid)" />
                <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
                  {/* Subtle bloom layer for selected nodes */}
                  {graphLayout.nodes.map((node) => {
                    const isSelected = selectedNode?.node_id === node.node_id;
                    if (!isSelected) return null;
                    const style = node.style;
                    return (
                      <circle
                        key={`glow-${node.node_id}`}
                        cx={node.x}
                        cy={node.y}
                        r={style.radius + 15}
                        fill={style.glow}
                        className="animate-pulse"
                      />
                    );
                  })}

                  {graphLayout.edges.map((edge) => {
                    const isHovered = edge.source.node_id === hoveredNodeId || edge.target.node_id === hoveredNodeId;
                    const isSelected = selectedNode && (edge.source.node_id === selectedNode.node_id || edge.target.node_id === selectedNode.node_id);
                    const isActive = isHovered || isSelected;
                    const hasActiveNode = hoveredNodeId || selectedNode;
                    const edgeClass = isActive ? "edge-active" : (hasActiveNode ? "edge-inactive" : "edge-default");

                    return (
                      <g key={edge.edge_id}>
                        <line
                          x1={edge.source.x}
                          y1={edge.source.y}
                          x2={edge.target.x}
                          y2={edge.target.y}
                          strokeWidth={isActive ? "2" : "1.2"}
                          strokeLinecap="round"
                          className={`${edgeClass} transition-colors duration-500`}
                        />
                        <text
                          x={(edge.source.x + edge.target.x) / 2}
                          y={(edge.source.y + edge.target.y) / 2 - 6}
                          textAnchor="middle"
                          className={`select-none text-[9px] font-bold uppercase tracking-[0.2em] transition-opacity duration-300 ${isActive ? 'fill-white/60' : 'fill-white/10'}`}
                        >
                          {edge.relationship_type.replace(/_/g, " ")}
                        </text>
                      </g>
                    );
                  })}

                  {graphLayout.nodes.map((node) => {
                    const isSelected = selectedNode?.node_id === node.node_id;
                    const isHovered = hoveredNodeId === node.node_id;
                    const labelStyle = LABEL_STYLES[getNodeLabel(node)];
                    const isDimmed = !isSelected && !isHovered && (selectedNode || hoveredNodeId);

                    return (
                      <g
                        key={node.node_id}
                        data-node-interactive="true"
                        transform={`translate(${node.x} ${node.y})`}
                        className="cursor-pointer"
                        style={{ '--glow-color': labelStyle.fill }}
                        onClick={() => setSelectedNodeId(node.node_id)}
                        onMouseEnter={() => setHoveredNodeId(node.node_id)}
                        onMouseLeave={() => setHoveredNodeId(null)}
                      >
                        {isSelected && (
                          <circle r={labelStyle.radius + 10} fill="transparent" stroke={labelStyle.glow} strokeWidth="3" className="animate-pulse" />
                        )}
                        <circle
                          r={labelStyle.radius}
                          fill={`url(#grad-${getNodeLabel(node)})`}
                          stroke={isSelected ? "#ffffff" : "transparent"}
                          strokeWidth={isSelected ? 2 : 0}
                          filter="url(#nodeShadow)"
                          className={`node-anim ${isHovered ? 'node-hovered' : ''}`}
                          style={{ opacity: isDimmed ? 0.35 : 1 }}
                        />
                        <text
                          y={labelStyle.radius + 22}
                          textAnchor="middle"
                          className={`select-none text-[11px] font-bold tracking-tight transition-all duration-300 ${isSelected || isHovered ? 'fill-white drop-shadow-md' : 'fill-white/50'}`}
                          style={{ opacity: isDimmed ? 0.2 : 1 }}
                        >
                          {node.display_name.length > 28 ? `${node.display_name.slice(0, 28)}...` : node.display_name}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>

              {/* Tooltip */}
              {hoveredNodeId && (
                <div 
                  className="pointer-events-none fixed z-[120] rounded-xl border border-white/10 bg-slate-900/90 px-4 py-3 shadow-2xl backdrop-blur-md transition-all duration-75 ease-out"
                  style={{
                    left: `${mousePos.x + 16}px`,
                    top: `${mousePos.y + 16}px`
                  }}
                >
                  {(() => {
                    const hoveredNode = graphLayout.nodes.find(n => n.node_id === hoveredNodeId);
                    if (!hoveredNode) return null;
                    return (
                      <>
                        <div className="flex items-center gap-2">
                           <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: LABEL_STYLES[getNodeLabel(hoveredNode)].fill }} />
                           <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">{hoveredNode.label}</span>
                        </div>
                        <p className="mt-1.5 max-w-[240px] text-sm font-medium text-white line-clamp-2">
                          {hoveredNode.display_name}
                        </p>
                      </>
                    )
                  })()}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-[24px] border border-dashed border-line bg-panel/50 p-12 text-center">
              <p className="text-lg font-medium text-ink">No graph nodes available for exploration.</p>
              <p className="mt-2 text-sm leading-7 text-muted">
                {status === "error"
                  ? error
                  : graphData?.detail || "Create and link Neo4j nodes to render the interactive graph."}
              </p>
            </div>
          )}
        </article>

        <aside className="rounded-[28px] border border-line bg-panel/95 p-6 shadow-panel-soft">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Node Details</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-ink">
              {selectedNode ? selectedNode.display_name : "No node selected"}
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted">
              Click any live node in the graph to inspect the properties stored in Neo4j for that entity.
            </p>
          </div>

          {selectedNode ? (
            <div className="mt-6 space-y-4">
              {selectedNode.label === "Paper" && (
                <div className="rounded-[24px] border border-red-500/20 bg-red-500/10 p-5 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-red-500">Danger Zone</p>
                  <button
                    onClick={handleDeleteNode}
                    disabled={!selectedNode?.details?.paper_id}
                    title={
                      selectedNode?.details?.paper_id
                        ? "Remove this paper from your research memory"
                        : "paper_id unavailable \u2014 cannot delete"
                    }
                    className="inline-flex items-center gap-1.5 flex-shrink-0 rounded-xl border border-red-500/30 bg-red-500/20 px-3 py-1.5 text-xs font-bold text-red-400 shadow-sm transition hover:bg-red-500/30 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                    Delete Paper
                  </button>
                </div>
              )}
              <div className="rounded-[24px] border border-line bg-canvas/30 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Node Type</p>
                <p className="mt-2 text-lg font-semibold text-ink">{selectedNode.label}</p>
              </div>

              <div className="rounded-[24px] border border-line bg-canvas/30 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Node Id</p>
                <p className="mt-2 break-all text-sm font-medium text-ink">{selectedNode.node_id}</p>
              </div>

              <div className="rounded-[24px] border border-line bg-canvas/30 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Properties</p>
                <div className="mt-4 space-y-3">
                  {Object.entries(selectedNode.details || {}).length ? (
                    <>
                      {/* Priority Actions: Open Paper */}
                      {(selectedNode.details.source_url || selectedNode.details.url || selectedNode.details.pdf_url || selectedNode.details.doi) && (
                        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-500">
                            Knowledge Source
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {(selectedNode.details.source_url || selectedNode.details.url) && (
                              <a
                                href={selectedNode.details.source_url || selectedNode.details.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-slate-900 active:scale-95"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                Open Paper
                              </a>
                            )}
                            {selectedNode.details.pdf_url && (
                              <a
                                href={selectedNode.details.pdf_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-xl border border-indigo-400 bg-indigo-500/10 px-4 py-2.5 text-xs font-bold text-indigo-400 transition hover:bg-indigo-500/20 active:scale-95"
                              >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                                View PDF
                              </a>
                            )}
                          </div>
                        </div>
                      )}

                      {Object.entries(selectedNode.details || {}).map(([key, value]) => {
                        // Skip rendering technical bits or already handled URLs
                        if (["url", "source_url", "pdf_url", "doi"].includes(key)) return null;
                        if (value === null || value === undefined || value === "") return null;

                        return (
                          <div key={key} className="rounded-2xl border border-line bg-panel px-4 py-3">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                              {formatLabelKey(key)}
                            </p>
                            <p className="mt-2 break-words text-sm leading-6 text-ink/90">
                              {typeof value === "object" ? JSON.stringify(value) : String(value)}
                            </p>
                          </div>
                        );
                      })}
                    </>
                  ) : (
                    <p className="text-sm text-muted">This node does not expose additional properties yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-dashed border-line bg-panel p-10 text-center">
              <p className="text-lg font-medium text-ink">No node selected.</p>
              <p className="mt-2 text-sm leading-7 text-muted">
                Once graph data is available, selecting a node will reveal its live details here.
              </p>
            </div>
          )}
        </aside>
      </section>
    </div>
  );
}

export default GraphExplorerPage;
