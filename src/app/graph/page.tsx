"use client";

import { useEffect, useRef, useState } from "react";
import cytoscape, { type Core } from "cytoscape";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ZoomIn, ZoomOut } from "lucide-react";

interface GraphNode {
  id: string;
  label: string;
  word: string;
  meaning: string;
  primaryTag: string | null;
  tagTypes: string[];
  due: string | null;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

const TAG_COLORS: Record<string, string> = {
  ROOT: "#0ea5e9",
  AFFIX: "#8b5cf6",
  MEANING: "#22c55e",
  GRAMMAR: "#f59e0b",
  CUSTOM: "#64748b",
};

export default function GraphPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<Core | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GraphNode | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const res = await fetch("/api/graph");
      const data = await res.json();
      if (cancelled || !containerRef.current) return;

      const cy = cytoscape({
        container: containerRef.current,
        elements: {
          nodes: data.nodes.map((n: GraphNode) => ({
            data: n,
          })),
          edges: data.edges.map((e: GraphEdge) => ({
            data: e,
          })),
        },
        style: [
          {
            selector: "node",
            style: {
              "background-color": (ele: { data: (k: string) => string }) =>
                TAG_COLORS[ele.data("tagTypes")?.[0]] ?? "#6366f1",
              label: "data(label)",
              color: "#0f172a",
              "font-size": 14,
              "font-weight": 600,
              "text-valign": "bottom",
              "text-margin-y": 6,
              width: 42,
              height: 42,
            },
          },
          {
            selector: "edge",
            style: {
              width: 2,
              "line-color": "#cbd5e1",
              "target-arrow-color": "#cbd5e1",
              "target-arrow-shape": "triangle",
              "curve-style": "bezier",
              label: "data(type)",
              "font-size": 9,
              "text-rotation": "autorotate",
              color: "#94a3b8",
            },
          },
        ],
        layout: {
          name: "cose",
          animate: true,
          nodeRepulsion: 8000,
          idealEdgeLength: 100,
        },
        wheelSensitivity: 0.3,
      });

      cy.on("tap", "node", (evt) => {
        const node = evt.target;
        setSelected(node.data() as GraphNode);
      });

      cyRef.current = cy;
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
      cyRef.current?.destroy();
    };
  }, []);

  const zoomBy = (delta: number) => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.zoom({ level: cy.zoom() + delta, renderedPosition: { x: 400, y: 300 } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">知识图谱</h1>
          <p className="text-sm text-muted">
            颜色代表标签类型：词根 / 词缀 / 意思 / 语法
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => zoomBy(0.2)}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => zoomBy(-0.2)}>
            <ZoomOut className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <Card className="relative flex-1 overflow-hidden p-0">
          <div ref={containerRef} className="h-[560px] w-full" />
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/60">
              <Loader2 className="h-6 w-6 animate-spin text-muted" />
            </div>
          )}
        </Card>

        {selected && (
          <Card className="w-64 shrink-0 self-start p-4">
            <h3 className="text-xl font-bold text-primary">{selected.word}</h3>
            <p className="mt-1 text-sm text-text">{selected.meaning}</p>
            {selected.primaryTag && (
              <p className="mt-2 text-xs text-muted">
                主要标签：{selected.primaryTag}
              </p>
            )}
            <p className="mt-1 text-xs text-muted">
              {selected.due
                ? `下次复习：${new Date(selected.due).toLocaleDateString("zh-CN")}`
                : "待首次学习"}
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
