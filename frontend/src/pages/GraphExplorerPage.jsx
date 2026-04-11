import { useEffect, useRef, useState } from "react";
import { fetchGraphData } from "../services/dashboard";

const GRAPH_WIDTH = 1100;
const GRAPH_HEIGHT = 720;
const LABEL_ORDER = ["Topic", "Paper", "Method", "Dataset", "Gap"];
const LABEL_STYLES = {
  Topic: {
    fill: "#111827",
    stroke: "#020617",
    text: "#ffffff",
    radius: 18,
    anchor: { x: 550, y: 120 },
  },
  Paper: {
    fill: "#f8fafc",
    stroke: "#cbd5e1",
    text: "#0f172a",
    radius: 15,
    anchor: { x: 860, y: 260 },
  },
  Method: {
    fill: "#e2e8f0",
    stroke: "#94a3b8",
    text: "#0f172a",
    radius: 14,
    anchor: { x: 760, y: 560 },
  },
  Dataset: {
    fill: "#f1f5f9",
    stroke: "#cbd5e1",
    text: "#0f172a",
    radius: 14,
    anchor: { x: 340, y: 560 },
  },
  Gap: {
    fill: "#dbe4f0",
    stroke: "#94a3b8",
    text: "#0f172a",
    radius: 15,
    anchor: { x: 240, y: 260 },
  },
};

function formatLabelKey(key) {
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
    const orbitRadius = Math.max(42, Math.min(170, 34 + group.length * 10));

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
  const graphContainerRef = useRef(null);
  const [graphData, setGraphData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [viewport, setViewport] = useState({ scale: 1, x: 0, y: 0 });
  const [dragState, setDragState] = useState(null);

  useEffect(() => {
    let isActive = true;

    async function loadGraphExplorer() {
      setStatus("loading");
      setError("");

      try {
        const graphResponse = await fetchGraphData();

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
  }, []);

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

  function handlePointerMove(event) {
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
      <section className="overflow-hidden rounded-[32px] border border-white/80 bg-slate-950 text-white shadow-panel">
        <div className="grid gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-10">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-300">Shared Graph Intelligence</p>
            <div className="space-y-3">
              <h1 className="max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">Graph Explorer</h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">
                Inspect live Neo4j nodes for topics, papers, methods, datasets, and gaps from one interactive canvas.
                Zoom the graph, pan across clusters, and click any node to inspect its actual stored properties.
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-5 shadow-panel-soft backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-300">Graph Status</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight text-white capitalize">{status}</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">
              {error || graphData?.detail || "Loading graph-backed data from the backend."}
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium uppercase tracking-[0.16em] text-slate-300">
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Zoom</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Pan</span>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-2">Node Details</span>
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => updateZoom(viewport.scale - 0.1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-white text-lg font-medium text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
              >
                -
              </button>
              <div className="min-w-[88px] rounded-2xl border border-line bg-white px-4 py-3 text-center text-sm font-semibold text-slate-900">
                {Math.round(viewport.scale * 100)}%
              </div>
              <button
                type="button"
                onClick={() => updateZoom(viewport.scale + 0.1)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-white text-lg font-medium text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => setViewport({ scale: 1, x: 0, y: 0 })}
                className="inline-flex items-center justify-center rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Reset
              </button>
            </div>
          </div>

          {graphLayout.nodes.length ? (
            <div
              ref={graphContainerRef}
              className="mt-5 overflow-hidden rounded-[24px] border border-line bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.88),rgba(248,250,252,0.95)_46%,rgba(226,232,240,0.88))]"
              onWheel={handleWheel}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onMouseLeave={handlePointerUp}
            >
              <svg
                viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                className={`h-[560px] w-full ${dragState ? "cursor-grabbing" : "cursor-grab"}`}
                onMouseDown={handlePointerDown}
              >
                <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.scale})`}>
                  {graphLayout.edges.map((edge) => (
                    <g key={edge.edge_id}>
                      <line
                        x1={edge.source.x}
                        y1={edge.source.y}
                        x2={edge.target.x}
                        y2={edge.target.y}
                        stroke="#cbd5e1"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <text
                        x={(edge.source.x + edge.target.x) / 2}
                        y={(edge.source.y + edge.target.y) / 2 - 6}
                        textAnchor="middle"
                        className="select-none fill-slate-400 text-[10px] font-semibold uppercase tracking-[0.18em]"
                      >
                        {edge.relationship_type}
                      </text>
                    </g>
                  ))}

                  {graphLayout.nodes.map((node) => {
                    const isSelected = selectedNode?.node_id === node.node_id;
                    const labelStyle = LABEL_STYLES[getNodeLabel(node)];

                    return (
                      <g
                        key={node.node_id}
                        data-node-interactive="true"
                        transform={`translate(${node.x} ${node.y})`}
                        className="cursor-pointer"
                        onClick={() => setSelectedNodeId(node.node_id)}
                      >
                        {isSelected ? (
                          <circle r={labelStyle.radius + 10} fill="rgba(15, 23, 42, 0.08)" />
                        ) : null}
                        <circle
                          r={labelStyle.radius + (isSelected ? 2 : 0)}
                          fill={labelStyle.fill}
                          stroke={isSelected ? "#111827" : labelStyle.stroke}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                        />
                        <text
                          y={labelStyle.radius + 22}
                          textAnchor="middle"
                          className="select-none fill-slate-700 text-[11px] font-semibold"
                        >
                          {node.display_name.length > 28 ? `${node.display_name.slice(0, 28)}...` : node.display_name}
                        </text>
                      </g>
                    );
                  })}
                </g>
              </svg>
            </div>
          ) : (
            <div className="mt-5 rounded-[24px] border border-dashed border-line bg-white/70 p-12 text-center">
              <p className="text-lg font-medium text-ink">No graph nodes available for exploration.</p>
              <p className="mt-2 text-sm leading-7 text-slate-500">
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
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Click any live node in the graph to inspect the properties stored in Neo4j for that entity.
            </p>
          </div>

          {selectedNode ? (
            <div className="mt-6 space-y-4">
              <div className="rounded-[24px] border border-line/80 bg-white/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Node Type</p>
                <p className="mt-2 text-lg font-semibold text-ink">{selectedNode.label}</p>
              </div>

              <div className="rounded-[24px] border border-line/80 bg-white/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Node Id</p>
                <p className="mt-2 break-all text-sm font-medium text-slate-700">{selectedNode.node_id}</p>
              </div>

              <div className="rounded-[24px] border border-line/80 bg-white/80 p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted">Properties</p>
                <div className="mt-4 space-y-3">
                  {Object.entries(selectedNode.details || {}).length ? (
                    Object.entries(selectedNode.details || {}).map(([key, value]) => (
                      <div key={key} className="rounded-2xl border border-line/70 bg-panel px-4 py-3">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
                          {formatLabelKey(key)}
                        </p>
                        <p className="mt-2 break-words text-sm leading-6 text-slate-700">
                          {value === null || value === undefined || value === ""
                            ? "Not available"
                            : typeof value === "object"
                              ? JSON.stringify(value)
                              : String(value)}
                        </p>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">This node does not expose additional properties yet.</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-[24px] border border-dashed border-line bg-white/70 p-10 text-center">
              <p className="text-lg font-medium text-ink">No node selected.</p>
              <p className="mt-2 text-sm leading-7 text-slate-500">
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
