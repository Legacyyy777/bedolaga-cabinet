import { create } from 'zustand';
import type {
  NetworkGraphData,
  SelectedNode,
  NetworkFilters,
  NetworkUserNode,
  NetworkCampaignNode,
} from '@/types/referralNetwork';

const DEFAULT_FILTERS: NetworkFilters = {
  campaigns: [],
  partnersOnly: false,
  minReferrals: 0,
};

interface ReferralNetworkState {
  networkData: NetworkGraphData | null;
  selectedNode: SelectedNode;
  hoveredNodeId: string | null;
  highlightedNodes: Set<string>;
  searchQuery: string;
  searchResults: { users: NetworkUserNode[]; campaigns: NetworkCampaignNode[] };
  filters: NetworkFilters;
  isFiltersOpen: boolean;

  setNetworkData: (data: NetworkGraphData) => void;
  setSelectedNode: (node: SelectedNode) => void;
  setHoveredNode: (id: string | null) => void;
  setHighlightedNodes: (nodes: Set<string>) => void;
  setSearchQuery: (query: string) => void;
  setSearchResults: (results: {
    users: NetworkUserNode[];
    campaigns: NetworkCampaignNode[];
  }) => void;
  updateFilters: (filters: Partial<NetworkFilters>) => void;
  resetFilters: () => void;
  setIsFiltersOpen: (open: boolean) => void;
}

export const useReferralNetworkStore = create<ReferralNetworkState>()((set) => ({
  networkData: null,
  selectedNode: null,
  hoveredNodeId: null,
  highlightedNodes: new Set<string>(),
  searchQuery: '',
  searchResults: { users: [], campaigns: [] },
  filters: { ...DEFAULT_FILTERS },
  isFiltersOpen: false,

  setNetworkData: (data) => set({ networkData: data }),

  setSelectedNode: (node) => set({ selectedNode: node }),

  setHoveredNode: (id) => set({ hoveredNodeId: id }),

  setHighlightedNodes: (nodes) => set({ highlightedNodes: nodes }),

  setSearchQuery: (query) => set({ searchQuery: query }),

  setSearchResults: (results) => set({ searchResults: results }),

  updateFilters: (partial) =>
    set((state) => ({
      filters: { ...state.filters, ...partial },
    })),

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS } }),

  setIsFiltersOpen: (open) => set({ isFiltersOpen: open }),
}));
