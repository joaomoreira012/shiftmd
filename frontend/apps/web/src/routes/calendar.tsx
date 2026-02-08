import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, DateSelectArg, EventClickArg, EventDropArg, DatesSetArg } from '@fullcalendar/core';
import type { EventResizeDoneArg } from '@fullcalendar/interaction';
import { toast } from 'sonner';
import { useShiftsInRange, useUpdateShift, useWorkplaces, useGCalStatus, useGCalSync } from '../lib/api';
import { useAppStore } from '@doctor-tracker/shared/stores/appStore';
import { formatEuros } from '@doctor-tracker/shared/utils/currency';
import { ShiftFormModal } from '../components/shifts/ShiftFormModal';
import { ShiftDetailModal } from '../components/shifts/ShiftDetailModal';
import { Skeleton } from '../components/ui/Skeleton';
import { ExportDropdown } from '../components/calendar/ExportDropdown';
import { exportCalendar, type ExportFormat } from '../lib/calendar-export';
import type { Shift } from '@doctor-tracker/shared/types/shift';

type CalendarView = 'timeGridDay' | 'timeGridWeek' | 'dayGridMonth';

const VIEW_MAP: Record<string, CalendarView> = {
  day: 'timeGridDay',
  week: 'timeGridWeek',
  month: 'dayGridMonth',
};

const VIEW_LABELS: { key: 'day' | 'week' | 'month'; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

export function CalendarPage() {
  const { t } = useTranslation();
  const calendarRef = useRef<FullCalendar>(null);
  const { currentView, setView, selectedWorkplaceIds, toggleWorkplace } = useAppStore();
  const { data: workplaces } = useWorkplaces();
  const updateShift = useUpdateShift();
  const { data: gcalStatus } = useGCalStatus();
  const gcalSync = useGCalSync();
  const [filterOpen, setFilterOpen] = useState(false);
  const [exportingWorkplaceId, setExportingWorkplaceId] = useState<string | null>(null);

  // Date range for fetching shifts
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const { data: shifts, isLoading: shiftsLoading } = useShiftsInRange(dateRange.start, dateRange.end);

  // Calendar container height (FullCalendar needs a pixel value for timeGrid scroll)
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const [calendarHeight, setCalendarHeight] = useState(600);

  useEffect(() => {
    const el = calendarContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height;
      if (h && h > 0) setCalendarHeight(Math.floor(h));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Modals
  const [createInfo, setCreateInfo] = useState<{ start: Date; end: Date } | null>(null);
  const [selectedShift, setSelectedShift] = useState<Shift | null>(null);

  const handleDatesSet = useCallback((arg: DatesSetArg) => {
    setDateRange({
      start: arg.start.toISOString(),
      end: arg.end.toISOString(),
    });
  }, []);

  const handleViewChange = (view: 'day' | 'week' | 'month') => {
    setView(view);
    calendarRef.current?.getApi().changeView(VIEW_MAP[view]);
  };

  // Click on empty time slot -> create shift
  const handleDateSelect = useCallback((selectInfo: DateSelectArg) => {
    setCreateInfo({ start: selectInfo.start, end: selectInfo.end });
    selectInfo.view.calendar.unselect();
  }, []);

  // Click on existing event -> view/edit shift
  const handleEventClick = useCallback((clickInfo: EventClickArg) => {
    const shift = (clickInfo.event.extendedProps as { shift: Shift }).shift;
    if (shift) setSelectedShift(shift);
  }, []);

  // Drag-and-drop move
  const handleEventDrop = useCallback((dropInfo: EventDropArg) => {
    const shift = (dropInfo.event.extendedProps as { shift: Shift }).shift;
    if (shift && dropInfo.event.start && dropInfo.event.end) {
      updateShift.mutate({
        id: shift.id,
        data: {
          start_time: dropInfo.event.start.toISOString(),
          end_time: dropInfo.event.end.toISOString(),
        },
      });
    }
  }, [updateShift]);

  // Resize event
  const handleEventResize = useCallback((resizeInfo: EventResizeDoneArg) => {
    const shift = (resizeInfo.event.extendedProps as { shift: Shift }).shift;
    if (shift && resizeInfo.event.start && resizeInfo.event.end) {
      updateShift.mutate({
        id: shift.id,
        data: {
          start_time: resizeInfo.event.start.toISOString(),
          end_time: resizeInfo.event.end.toISOString(),
        },
      });
    }
  }, [updateShift]);

  // Export calendar for a single workplace
  const handleExport = useCallback(async (workplaceId: string, format: ExportFormat) => {
    const el = calendarContainerRef.current;
    if (!el) return;

    const wp = workplaces?.find((w) => w.id === workplaceId);
    if (!wp) return;

    setExportingWorkplaceId(workplaceId);
    const prevIds = useAppStore.getState().selectedWorkplaceIds;

    try {
      // Filter to only the target workplace
      useAppStore.setState({ selectedWorkplaceIds: [workplaceId] });
      // Wait for React to re-render with the filtered events
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const calApi = calendarRef.current?.getApi();
      const dateLabel = calApi?.view.title ?? '';

      await exportCalendar({ element: el, workplaceName: wp.name, dateLabel, format });
      toast.success(t('calendar.exportSuccess'));
    } catch {
      toast.error(t('calendar.exportError'));
    } finally {
      useAppStore.setState({ selectedWorkplaceIds: prevIds });
      setExportingWorkplaceId(null);
    }
  }, [workplaces, t]);

  // Filter shifts by selected workplaces
  const filteredShifts = shifts?.filter((s) =>
    selectedWorkplaceIds.length === 0 || selectedWorkplaceIds.includes(s.workplace_id)
  );

  // Map shifts to FullCalendar events
  const events: EventInput[] = (filteredShifts || []).map((shift) => {
    const workplace = workplaces?.find((w) => w.id === shift.workplace_id);
    const earningsLabel = shift.total_earnings != null
      ? ` (${formatEuros(shift.total_earnings)})`
      : '';
    return {
      id: shift.id,
      title: `${workplace?.name || 'Shift'}${earningsLabel}`,
      start: shift.start_time,
      end: shift.end_time,
      backgroundColor: workplace?.color || '#6B7280',
      borderColor: workplace?.color || '#6B7280',
      extendedProps: { shift },
    };
  });

  // Auto-scroll to earliest event so shifts are visible in week/day views
  const scrollTime = useMemo(() => {
    if (!events.length) return '08:00:00';
    const minutes = events.map((e) => {
      const d = new Date(e.start as string);
      return d.getHours() * 60 + d.getMinutes();
    });
    const earliest = Math.min(...minutes);
    const h = Math.max(6, Math.floor(earliest / 60) - 1);
    return `${h.toString().padStart(2, '0')}:00:00`;
  }, [events]);

  const sidebarContent = (
    <>
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
        <h3 className="text-sm font-semibold mb-3">{t('calendar.workplaces')}</h3>
        {workplaces?.map((wp) => (
          <div key={wp.id} className="flex items-center gap-1 py-1.5">
            <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
              <input
                type="checkbox"
                checked={selectedWorkplaceIds.length === 0 || selectedWorkplaceIds.includes(wp.id)}
                onChange={() => toggleWorkplace(wp.id)}
                className="rounded border-gray-300"
              />
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: wp.color || '#6B7280' }}
              />
              <span className="text-sm truncate">{wp.name}</span>
            </label>
            <ExportDropdown
              onExport={(format) => handleExport(wp.id, format)}
              isExporting={exportingWorkplaceId === wp.id}
            />
          </div>
        ))}
        {(!workplaces || workplaces.length === 0) && (
          <p className="text-xs text-gray-400">{t('calendar.noWorkplaces')}</p>
        )}
      </div>

      {/* Google Calendar sync */}
      {gcalStatus?.connected && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
          <h3 className="text-sm font-semibold mb-3">{t('calendar.googleCalendar')}</h3>
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-green-600 dark:text-green-400">{t('calendar.connected')}</span>
          </div>
          {gcalStatus.last_sync && (
            <p className="text-xs text-gray-400 mb-3">
              {t('calendar.synced', { date: new Date(gcalStatus.last_sync).toLocaleString(undefined, {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              }) })}
            </p>
          )}
          <button
            onClick={() => gcalSync.mutate()}
            disabled={gcalSync.isPending}
            className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-medium disabled:opacity-50"
          >
            {gcalSync.isPending ? t('calendar.syncing') : t('calendar.syncNow')}
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className="flex gap-6 h-[calc(100vh-7rem)] lg:h-[calc(100vh-7rem)]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-52 flex-shrink-0 space-y-4">
        {sidebarContent}
      </aside>

      {/* Mobile filter overlay */}
      {filterOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setFilterOpen(false)} />
          <div className="absolute right-0 top-0 h-full w-64 bg-gray-50 dark:bg-gray-950 p-4 space-y-4 z-50 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold text-sm">{t('calendar.filters')}</h3>
              <button onClick={() => setFilterOpen(false)} className="text-gray-400 hover:text-gray-600 text-sm">{t('calendar.close')}</button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Calendar */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* View controls */}
        <div className="flex items-center justify-between mb-4 gap-2 flex-shrink-0">
          <h1 className="text-xl lg:text-2xl font-bold">{t('calendar.title')}</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterOpen(true)}
              className="lg:hidden px-3 py-1.5 text-sm rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              {t('calendar.filter')}
            </button>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {VIEW_LABELS.map(({ key }) => (
                <button
                  key={key}
                  onClick={() => handleViewChange(key)}
                  className={`px-3 py-1.5 text-sm rounded-md font-medium transition-colors ${
                    currentView === key
                      ? 'bg-white dark:bg-gray-700 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t('calendar.' + key)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* FullCalendar */}
        {shiftsLoading && !shifts ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 space-y-3 flex-1 min-h-0">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-[400px] w-full" />
          </div>
        ) : (
          <div ref={calendarContainerRef} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-2 lg:p-4 calendar-container flex-1 min-h-0">
            <FullCalendar
              ref={calendarRef}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={VIEW_MAP[currentView]}
              headerToolbar={{
                left: 'prev,next today',
                center: 'title',
                right: '',
              }}
              editable
              selectable
              selectMirror
              dayMaxEvents
              weekends
              allDaySlot={false}
              slotMinTime="06:00:00"
              slotMaxTime="30:00:00"
              slotDuration="00:30:00"
              snapDuration="00:15:00"
              scrollTime={scrollTime}
              nowIndicator
              events={events}
              datesSet={handleDatesSet}
              select={handleDateSelect}
              eventClick={handleEventClick}
              eventDrop={handleEventDrop}
              eventResize={handleEventResize}
              height={calendarHeight}
              eventDisplay="block"
              eventTimeFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
              slotLabelFormat={{
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              }}
            />
          </div>
        )}
      </div>

      {/* Create Shift Modal */}
      {createInfo && (
        <ShiftFormModal
          defaultStart={createInfo.start}
          defaultEnd={createInfo.end}
          onClose={() => setCreateInfo(null)}
        />
      )}

      {/* Shift Detail Modal */}
      {selectedShift && (
        <ShiftDetailModal
          shiftId={selectedShift.id}
          onClose={() => setSelectedShift(null)}
        />
      )}
    </div>
  );
}
