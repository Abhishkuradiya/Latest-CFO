import { create } from 'zustand';

interface SidebarState {
  isCollapsed: boolean;
  isOpenMobile: boolean;
  toggleSidebar: () => void;
  setCollapsed: (collapsed: boolean) => void;
  setOpenMobile: (open: boolean) => void;
}

export const useSidebarStore = create<SidebarState>((set) => ({
  isCollapsed: true,
  isOpenMobile: false,
  toggleSidebar: () => set((state) => ({ isCollapsed: !state.isCollapsed })),
  setCollapsed: (isCollapsed) => set({ isCollapsed }),
  setOpenMobile: (isOpenMobile) => set({ isOpenMobile }),
}));
