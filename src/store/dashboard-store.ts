import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WidgetLayout {
  id: string;
  w: number;
  h: number;
  x: number;
  y: number;
}

export interface Dashboard {
  id: string;
  name: string;
  description?: string;
  isCustomizable: boolean;
  widgets: WidgetLayout[];
}

interface DashboardState {
  dashboards: Dashboard[];
  activeDashboardId: string | null;
  isEditingLayout: boolean;
  setDashboards: (dashboards: Dashboard[]) => void;
  setActiveDashboardId: (id: string) => void;
  setEditingLayout: (isEditing: boolean) => void;
  updateWidgetLayout: (dashboardId: string, widgetId: string, layout: Partial<WidgetLayout>) => void;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set) => ({
      dashboards: [],
      activeDashboardId: null,
      isEditingLayout: false,
      setDashboards: (dashboards) => set({ dashboards }),
      setActiveDashboardId: (activeDashboardId) => set({ activeDashboardId }),
      setEditingLayout: (isEditingLayout) => set({ isEditingLayout }),
      updateWidgetLayout: (dashboardId, widgetId, layout) =>
        set((state) => ({
          dashboards: state.dashboards.map((dash) => {
            if (dash.id !== dashboardId) return dash;
            return {
              ...dash,
              widgets: dash.widgets.map((w) =>
                w.id === widgetId ? { ...w, ...layout } : w
              ),
            };
          }),
        })),
    }),
    {
      name: 'cfo-dashboard-store',
    }
  )
);
