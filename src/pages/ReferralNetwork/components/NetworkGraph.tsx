import { useEffect, useRef, useCallback } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import FA2LayoutSupervisor from 'graphology-layout-forceatlas2/worker';
import { useReferralNetworkStore } from '@/store/referralNetwork';
import type { NetworkGraphData, NetworkFilters } from '@/types/referralNetwork';
import { getUserNodeColor, getUserNodeSize, getCampaignColor } from '../utils';
import { setSigmaInstance, setGraphInstance } from '../sigmaGlobals';

interface NetworkGraphProps {
  data: NetworkGraphData;
  className?: string;
}

/**
 * Build the full graph from data (no filter logic).
 * Stores filter-relevant attributes on nodes so reducers can check them.
 */
function buildFullGraph(graphData: NetworkGraphData): Graph {
  const graph = new Graph();

  graphData.campaigns.forEach((campaign, index) => {
    graph.addNode(`campaign_${campaign.id}`, {
      label: campaign.name,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 18,
      color: getCampaignColor(index),
      type: 'circle',
      nodeType: 'campaign',
      nodeId: campaign.id,
    });
  });

  graphData.users.forEach((user) => {
    const color = getUserNodeColor(user.direct_referrals, user.is_partner, user.campaign_id);
    const size = getUserNodeSize(user.direct_referrals);

    graph.addNode(`user_${user.id}`, {
      label: user.display_name,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size,
      color,
      type: 'circle',
      nodeType: 'user',
      nodeId: user.id,
      isPartner: user.is_partner,
      directReferrals: user.direct_referrals,
      campaignId: user.campaign_id,
    });
  });

  graphData.edges.forEach((edge) => {
    if (graph.hasNode(edge.source) && graph.hasNode(edge.target)) {
      const edgeKey = `${edge.source}->${edge.target}`;
      if (!graph.hasEdge(edgeKey)) {
        graph.addEdgeWithKey(edgeKey, edge.source, edge.target, {
          color: edge.type === 'campaign' ? 'rgba(77, 217, 192, 0.12)' : 'rgba(255,255,255,0.06)',
          size: 0.5,
          edgeType: edge.type,
        });
      }
    }
  });

  return graph;
}

/**
 * Compute set of node keys that should be hidden based on current filters.
 */
function computeHiddenNodes(graph: Graph, filters: NetworkFilters): Set<string> {
  const hidden = new Set<string>();
  const filterCampaignSet = new Set(filters.campaigns);
  const hasCampaignFilter = filterCampaignSet.size > 0;

  graph.forEachNode((node, attrs) => {
    if (attrs.nodeType === 'user') {
      if (filters.partnersOnly && !attrs.isPartner) {
        hidden.add(node);
      } else if ((attrs.directReferrals ?? 0) < filters.minReferrals) {
        hidden.add(node);
      } else if (
        hasCampaignFilter &&
        attrs.campaignId !== null &&
        !filterCampaignSet.has(attrs.campaignId)
      ) {
        hidden.add(node);
      }
    } else if (attrs.nodeType === 'campaign') {
      if (hasCampaignFilter && !filterCampaignSet.has(attrs.nodeId)) {
        hidden.add(node);
      }
    }
  });

  return hidden;
}

const FA2_DURATION_MS = 5000;

export function NetworkGraph({ data, className }: NetworkGraphProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sigmaRef = useRef<Sigma | null>(null);
  const graphRef = useRef<Graph | null>(null);
  const hiddenNodesRef = useRef<Set<string>>(new Set());
  const fa2Ref = useRef<FA2LayoutSupervisor | null>(null);
  const fa2TimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setSelectedNode = useReferralNetworkStore((s) => s.setSelectedNode);
  const setHoveredNode = useReferralNetworkStore((s) => s.setHoveredNode);
  const hoveredNodeId = useReferralNetworkStore((s) => s.hoveredNodeId);
  const highlightedNodes = useReferralNetworkStore((s) => s.highlightedNodes);
  const filters = useReferralNetworkStore((s) => s.filters);
  const setNetworkData = useReferralNetworkStore((s) => s.setNetworkData);

  const killFA2 = useCallback(() => {
    if (fa2TimerRef.current !== null) {
      clearTimeout(fa2TimerRef.current);
      fa2TimerRef.current = null;
    }
    if (fa2Ref.current) {
      fa2Ref.current.kill();
      fa2Ref.current = null;
    }
  }, []);

  // Initialize sigma — only re-runs when data changes (NOT on filter changes)
  useEffect(() => {
    if (!containerRef.current || !data) return;

    // Cleanup previous instance
    killFA2();
    if (sigmaRef.current) {
      sigmaRef.current.kill();
      sigmaRef.current = null;
    }

    const graph = buildFullGraph(data);
    graphRef.current = graph;

    setNetworkData(data);

    // Compute initial hidden set from current filters
    const initialFilters = useReferralNetworkStore.getState().filters;
    hiddenNodesRef.current = computeHiddenNodes(graph, initialFilters);

    const sigma = new Sigma(graph, containerRef.current, {
      renderEdgeLabels: false,
      labelDensity: 0.5,
      labelRenderedSizeThreshold: 6,
      zIndex: true,
      defaultEdgeColor: '#ffffff10',
      defaultNodeColor: '#6b7280',
      labelColor: { color: '#e8e6f0' },
      labelFont: 'Inter, system-ui, sans-serif',
      labelSize: 12,
      stagePadding: 40,
      nodeReducer: (node, attrs) => {
        const res = { ...attrs };

        // Filter visibility (read from pre-computed set)
        if (hiddenNodesRef.current.has(node)) {
          res.hidden = true;
          return res;
        }

        const store = useReferralNetworkStore.getState();
        const hovered = store.hoveredNodeId;
        const highlighted = store.highlightedNodes;

        // Search highlighting
        if (highlighted.size > 0) {
          if (highlighted.has(node)) {
            res.highlighted = true;
            res.zIndex = 2;
          } else {
            res.color = `${attrs.color}33`;
            res.label = '';
            res.zIndex = 0;
          }
        }

        // Hover highlighting
        if (hovered) {
          if (node === hovered) {
            res.highlighted = true;
            res.zIndex = 2;
          } else if (graph.hasNode(hovered) && graph.areNeighbors(node, hovered)) {
            res.highlighted = true;
            res.zIndex = 1;
          } else if (!highlighted.has(node)) {
            res.color = `${attrs.color}33`;
            res.label = '';
            res.zIndex = 0;
          }
        }

        return res;
      },
      edgeReducer: (edge, attrs) => {
        const res = { ...attrs };

        // Hide edges connected to filtered-out nodes
        const [source, target] = graph.extremities(edge);
        if (hiddenNodesRef.current.has(source) || hiddenNodesRef.current.has(target)) {
          res.hidden = true;
          return res;
        }

        const store = useReferralNetworkStore.getState();
        const hovered = store.hoveredNodeId;
        const highlighted = store.highlightedNodes;

        if (hovered && graph.hasNode(hovered)) {
          if (!graph.hasExtremity(edge, hovered)) {
            res.hidden = true;
          } else {
            res.color = '#ffffff30';
            res.size = 1;
          }
        } else if (highlighted.size > 0) {
          if (!highlighted.has(source) && !highlighted.has(target)) {
            res.hidden = true;
          }
        }

        return res;
      },
    });

    sigmaRef.current = sigma;

    // Expose to module-level globals for search/controls
    setSigmaInstance(sigma);
    setGraphInstance(graph);

    // Start ForceAtlas2 in a web worker (non-blocking)
    if (graph.order > 0) {
      const supervisor = new FA2LayoutSupervisor(graph, {
        settings: {
          gravity: 1,
          scalingRatio: 2,
          barnesHutOptimize: true,
        },
      });
      fa2Ref.current = supervisor;
      supervisor.start();

      // Kill after a fixed duration to free the web worker thread
      fa2TimerRef.current = setTimeout(() => {
        if (fa2Ref.current === supervisor) {
          supervisor.kill();
          fa2Ref.current = null;
        }
        fa2TimerRef.current = null;
      }, FA2_DURATION_MS);
    }

    // Click handler
    sigma.on('clickNode', ({ node }) => {
      const attrs = graph.getNodeAttributes(node);
      const nodeType = attrs.nodeType;
      const nodeId = attrs.nodeId;

      if (typeof nodeId !== 'number') return;

      if (nodeType === 'user') {
        setSelectedNode({ type: 'user', id: nodeId });
      } else if (nodeType === 'campaign') {
        setSelectedNode({ type: 'campaign', id: nodeId });
      }
    });

    // Click on stage deselects
    sigma.on('clickStage', () => {
      setSelectedNode(null);
    });

    // Hover handler
    sigma.on('enterNode', ({ node }) => {
      setHoveredNode(node);
      if (containerRef.current) {
        containerRef.current.style.cursor = 'pointer';
      }
    });

    sigma.on('leaveNode', () => {
      setHoveredNode(null);
      if (containerRef.current) {
        containerRef.current.style.cursor = 'default';
      }
    });

    return () => {
      killFA2();
      sigma.kill();
      sigmaRef.current = null;
      graphRef.current = null;
      setSigmaInstance(null);
      setGraphInstance(null);
    };
  }, [data, setSelectedNode, setHoveredNode, setNetworkData, killFA2]);

  // Recompute hidden nodes when filters change, then refresh sigma
  // (no graph rebuild — positions and Sigma instance preserved)
  useEffect(() => {
    if (!graphRef.current || !sigmaRef.current) return;
    hiddenNodesRef.current = computeHiddenNodes(graphRef.current, filters);
    sigmaRef.current.refresh();
  }, [filters]);

  // Refresh sigma on hover/highlight changes
  useEffect(() => {
    if (sigmaRef.current) {
      sigmaRef.current.refresh();
    }
  }, [hoveredNodeId, highlightedNodes]);

  return <div ref={containerRef} className={`bg-[#0a0a0f] ${className ?? ''}`} />;
}
