import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// 侧边栏宽度约束（px）：拖拽调宽时 clamp 到此区间，避免过窄看不清或过宽挤占内容区
export const SIDEBAR_WIDTH_MIN = 180
export const SIDEBAR_WIDTH_MAX = 400
export const SIDEBAR_WIDTH_DEFAULT = 224
export const SIDEBAR_COLLAPSED_WIDTH = 64

export const clampSidebarWidth = (w: number) =>
  Math.min(SIDEBAR_WIDTH_MAX, Math.max(SIDEBAR_WIDTH_MIN, Math.round(w)))

interface UIState {
  sidebarCollapsed: boolean
  sidebarWidth: number   // 展开态宽度（px），持久化
  isResizing: boolean    // 是否正在拖拽（不持久化；拖拽时禁用宽度过渡以保证跟手）
  adminAppId: string     // 管理端当前应用筛选（all=全部应用），持久化
  toggleSidebar: () => void
  setSidebarCollapsed: (collapsed: boolean) => void
  setSidebarWidth: (width: number) => void
  setResizing: (resizing: boolean) => void
  setAdminAppId: (appId: string) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      sidebarWidth: SIDEBAR_WIDTH_DEFAULT,
      isResizing: false,
      adminAppId: 'all',
      toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setSidebarWidth: (width) => set({ sidebarWidth: clampSidebarWidth(width) }),
      setResizing: (resizing) => set({ isResizing: resizing }),
      setAdminAppId: (appId) => set({ adminAppId: appId || 'all' }),
    }),
    {
      name: 'ui-storage',
      // isResizing 是拖拽临时态，不写入 localStorage
      partialize: (state) => ({
        sidebarCollapsed: state.sidebarCollapsed,
        sidebarWidth: state.sidebarWidth,
        adminAppId: state.adminAppId,
      }),
    }
  )
)
