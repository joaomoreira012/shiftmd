import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark' | 'system';

interface CalendarState {
  currentView: 'day' | 'week' | 'month';
  currentDate: string;
  selectedShiftId: string | null;
  selectedWorkplaceIds: string[];
  showGoogleCalendarEvents: boolean;
  sidebarOpen: boolean;
  theme: Theme;
}

interface CalendarActions {
  setView: (view: 'day' | 'week' | 'month') => void;
  setDate: (date: string) => void;
  selectShift: (id: string | null) => void;
  toggleWorkplace: (id: string) => void;
  setShowGoogleEvents: (show: boolean) => void;
  toggleSidebar: () => void;
  setTheme: (theme: Theme) => void;
}

function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return;
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
}

export const useAppStore = create<CalendarState & CalendarActions>()(
  persist(
    (set) => ({
      // State
      currentView: 'week',
      currentDate: new Date().toISOString(),
      selectedShiftId: null,
      selectedWorkplaceIds: [],
      showGoogleCalendarEvents: true,
      sidebarOpen: true,
      theme: 'system',

      // Actions
      setView: (view) => set({ currentView: view }),
      setDate: (date) => set({ currentDate: date }),
      selectShift: (id) => set({ selectedShiftId: id }),
      toggleWorkplace: (id) =>
        set((state) => ({
          selectedWorkplaceIds: state.selectedWorkplaceIds.includes(id)
            ? state.selectedWorkplaceIds.filter((wId) => wId !== id)
            : [...state.selectedWorkplaceIds, id],
        })),
      setShowGoogleEvents: (show) => set({ showGoogleCalendarEvents: show }),
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setTheme: (theme) => {
        applyTheme(theme);
        set({ theme });
      },
    }),
    {
      name: 'doctor-tracker-ui',
      partialize: (state) => ({
        currentView: state.currentView,
        selectedWorkplaceIds: state.selectedWorkplaceIds,
        showGoogleCalendarEvents: state.showGoogleCalendarEvents,
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) applyTheme(state.theme);
      },
    }
  )
);

// Listen for system theme changes
if (typeof window !== 'undefined') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useAppStore.getState();
    if (theme === 'system') applyTheme('system');
  });
}
