# ShiftMD UX Design Reviewer Memory

## Critical Findings

### Calendar Shift Status Visibility (2026-02-08)
**Problem**: Shift status (scheduled/confirmed/completed/cancelled) is invisible on calendar events. Users can't tell shift state without clicking each event.

**Impact**: Users miss confirmations, can accidentally edit finalised shifts, workflow friction between dashboard (shows "Shifts to Confirm") and calendar (shows no status).

**Solution Pattern**:
1. Add status to event title or use CSS class-based styling (`shift-status-{status}`)
2. Disable editing for completed/cancelled shifts via FullCalendar `editable` field
3. Add status-based visual treatments: scheduled=bold/2px border, confirmed=normal, completed=faded, cancelled=red/strikethrough
4. Extract status colors to shared constant (`SHIFT_STATUS_COLORS`)

**Status Colors** (from ShiftDetailModal):
- scheduled: blue-100/700 (light) or blue-900/300 (dark)
- confirmed: emerald-100/700 (light) or emerald-900/300 (dark)
- completed: gray-100/700 (light) or gray-800/300 (dark)
- cancelled: red-100/700 (light) or red-900/300 (dark)

## UI Patterns

### Status Display
- Modal: Semantic color badges work well (lines 30-35 in ShiftDetailModal)
- Calendar: Currently missing; needs visual treatment
- Recommendation: Harmonize both via shared constant

### Form Validation
- ShiftConfirmCard: Good example of conditional required fields (patients_seen, outside_visits)
- Pattern: Check workplace config to determine required fields at form time

### Calendar Interactions
- FullCalendar setup uses eventDisplay="block", 1-hour slots, Monday start
- Editable globally; should be conditional per event status
- Workplace colors + names effectively identify shifts

## Accessibility Notes
- Calendar events: No aria-labels for status (opportunity to add)
- Status badges in modal: Proper semantic color usage (not color-only)
- Shift confirm card: aria-required on number inputs is good

## i18n Status
- All shift status labels in en.json + pt.json (lines 110-113)
- Calendar view labels ("Day", "Week", "Month") hardcoded in JS (not i18n) - minor issue
- Ready to add "calendar.statusFilter" key if status filter implemented

## Next Steps if Implementing
1. Update event mapping in calendar.tsx to include `classNames: [shift-status-${status}]` and status styling
2. Add CSS in globals.css for `.shift-status-{status}` classes
3. Extract STATUS_COLORS constant to shared/constants/shiftStatus.ts
4. Add status filter UI to calendar sidebar (optional, high-value feature)
5. Ensure FullCalendar events have `editable: false` for completed/cancelled
