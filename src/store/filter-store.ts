import { create } from 'zustand';

export interface DateRange {
  startDate: string; // ISO string
  endDate: string; // ISO string
  preset: 'today' | 'yesterday' | 'last_7_days' | 'last_30_days' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year' | 'custom';
}

interface FilterState {
  dateRange: DateRange;
  selectedConnectors: string[]; // connector IDs
  currency: string;
  segmentationFilters: Record<string, string[]>;
  setDateRange: (range: Partial<DateRange>) => void;
  setSelectedConnectors: (connectorIds: string[]) => void;
  toggleConnector: (connectorId: string) => void;
  setCurrency: (currency: string) => void;
  setSegmentationFilter: (key: string, values: string[]) => void;
  clearFilters: () => void;
}

const defaultDateRange: DateRange = {
  startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 days ago
  endDate: new Date().toISOString().split('T')[0], // today
  preset: 'last_30_days',
};

export const useFilterStore = create<FilterState>((set) => ({
  dateRange: defaultDateRange,
  selectedConnectors: [],
  currency: 'USD',
  segmentationFilters: {},
  setDateRange: (range) => set((state) => ({ dateRange: { ...state.dateRange, ...range } })),
  setSelectedConnectors: (selectedConnectors) => set({ selectedConnectors }),
  toggleConnector: (connectorId) =>
    set((state) => ({
      selectedConnectors: state.selectedConnectors.includes(connectorId)
        ? state.selectedConnectors.filter((id) => id !== connectorId)
        : [...state.selectedConnectors, connectorId],
    })),
  setCurrency: (currency) => set({ currency }),
  setSegmentationFilter: (key, values) =>
    set((state) => ({
      segmentationFilters: {
        ...state.segmentationFilters,
        [key]: values,
      },
    })),
  clearFilters: () =>
    set({
      dateRange: defaultDateRange,
      selectedConnectors: [],
      currency: 'USD',
      segmentationFilters: {},
    }),
}));
