(() => {
    const escapeQuotedValue = v => `${v || ""}`.replaceAll('"', '\\"');
    const toTimestampString = v => {
        if (!v) return "";
        const parsedDate = new Date(v);
        if (Number.isNaN(parsedDate.getTime())) return "";
        const [datePart = "", timePart = ""] = `${v}`.split("T");
        const [year = "", month = "", day = ""] = datePart.split("-");
        const [hours = "00", minutes = "00"] = timePart.split(":");
        if (!year || !month || !day) return "";
        return `${month.padStart(2, "0")}/${day.padStart(2, "0")}/${year} ${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;
    };
    const toDateTimeLocalValue = (v, h, m = 0) => {
        const parsedDate = new Date(v);
        if (Number.isNaN(parsedDate.getTime())) return "";
        const localDate = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), h, m, 0, 0);
        const pad = part => `${part}`.padStart(2, "0");
        return `${localDate.getFullYear()}-${pad(localDate.getMonth() + 1)}-${pad(localDate.getDate())}T${pad(localDate.getHours())}:${pad(localDate.getMinutes())}`;
    };
    const toDateTimeLabel = v => {
        const parsedDate = toDateObject(v);
        if (!parsedDate) return "";
        return parsedDate.toLocaleString([], {year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit"});
    };
    const getCategoriesList = r => {
        if (!r || typeof r !== "object") return [];
        if (Array.isArray(r.categories)) return r.categories;
        if (Array.isArray(r.cats)) return r.cats;
        return [];
    };
    const getEventsList = r => {
        if (Array.isArray(r)) return r;
        if (!r || typeof r !== "object") return [];
        if (Array.isArray(r.events)) return r.events;
        if (Array.isArray(r.data)) return r.data;
        return [];
    };
    const getEventBoundary = (e, b) => {
        if (!e || typeof e !== "object") return null;
        const preferredKeys = b === "start" ? ["start", "start_at", "startAt", "from", "date_start", "start_date", "datetime_start"] : ["end", "end_at", "endAt", "to", "date_end", "end_date", "datetime_end"];
        for (const key of preferredKeys) {
            const v = e?.[key];
            if (v !== undefined && v !== null && v !== "") return v;
        }
        return null;
    };
    const normalizeRecordId = value => `${value ?? ""}`.trim().replace(/^['"]+|['"]+$/g, "").replace(/^@+/, "").trim();
    const getSelectedEventCategoryId = event => {
        if (!event || typeof event !== "object") return "";
        const candidateValues = [
            event?.category?.id,
            event?.category_id,
            event?.categoryId,
            event?.cat,
            event?.cat_id,
            event?.catId
        ];
        const matchedValue = candidateValues.find(value => value !== undefined && value !== null && `${value}`.trim() !== "");
        return matchedValue === undefined ? "" : normalizeRecordId(matchedValue);
    };
    const toDateObject = value => {
        if (value === undefined || value === null || value === "") return null;
        if (typeof value === "string") {
            const dateOnlyMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
            if (dateOnlyMatch) {
                const [, year, month, day] = dateOnlyMatch;
                return new Date(Number(year), Number(month) - 1, Number(day));
            }
        }
        const numericValue = Number(value);
        const parsedDate = Number.isNaN(numericValue) ? new Date(value) : new Date(numericValue);
        return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
    };
    const toLocalDateKey = value => {
        const parsedDate = value instanceof Date ? value : toDateObject(value);
        if (!parsedDate) return "";
        const month = `${parsedDate.getMonth() + 1}`.padStart(2, "0");
        const date = `${parsedDate.getDate()}`.padStart(2, "0");
        return `${parsedDate.getFullYear()}-${month}-${date}`;
    };
    const toCalendarTitleDate = value => {
        const parsedDate = toDateObject(value);
        return parsedDate ? parsedDate.toLocaleDateString([], {year: "numeric", month: "long", day: "numeric"}) : "Untitled";
    };
    const getOrderedDateRange = (start, end) => {
        const parsedStart = toDateObject(start);
        const parsedEnd = toDateObject(end);
        if (!parsedStart || !parsedEnd) return {start: null, end: null};
        return parsedStart <= parsedEnd ? {start: parsedStart, end: parsedEnd} : {start: parsedEnd, end: parsedStart};
    };
    const isDateKeyInRange = (dateKey, start, end) => {
        if (!dateKey || !start || !end) return false;
        const startKey = toLocalDateKey(start);
        const endKey = toLocalDateKey(end);
        if (!startKey || !endKey) return false;
        return dateKey >= startKey && dateKey <= endKey;
    };
    const updateSelectedDateFromTarget = target => {
        const tile = target?.closest?.('[data]');
        const dateKey = tile?.getAttribute?.('data') || '';
        if (dateKey === '') return;
        const parsedDate = toDateObject(dateKey);
        if (!parsedDate) return;
        const hasMultiDaySelection = selectedDateRangeStart && selectedDateRangeEnd && toLocalDateKey(selectedDateRangeStart) !== toLocalDateKey(selectedDateRangeEnd);
        if (hasMultiDaySelection && isDateKeyInRange(dateKey, selectedDateRangeStart, selectedDateRangeEnd)) return;
        selectedDate = parsedDate;
        selectedDateRangeStart = parsedDate;
        selectedDateRangeEnd = parsedDate;
        clearCreateEventDateTimeRange();
    };
    const getCreateEventDateRange = () => {
        const {start, end} = getOrderedDateRange(selectedDateRangeStart || selectedDate, selectedDateRangeEnd || selectedDate);
        if (!start || !end) return {start: selectedDate, end: selectedDate};
        return {start, end};
    };
    const getCreateEventPortalTitle = () => {
        const {start, end} = getCreateEventDateRange();
        const startKey = toLocalDateKey(start);
        const endKey = toLocalDateKey(end);
        if (!startKey || !endKey || startKey === endKey) return toCalendarTitleDate(start || selectedDate);
        return `${toCalendarTitleDate(start)} - ${toCalendarTitleDate(end)}`;
    };
    const DAY_IN_MS = 86400000;
    const getStartOfWeek = value => {
        const parsedDate = toDateObject(value);
        if (!parsedDate) return null;
        return new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate() - parsedDate.getDay());
    };
    const getWeekDates = value => {
        const startOfWeek = getStartOfWeek(value);
        if (!startOfWeek) return [];
        return Array.from({length: 7}, (_, index) => new Date(startOfWeek.getFullYear(), startOfWeek.getMonth(), startOfWeek.getDate() + index));
    };
    const isSameLocalDay = (left, right) => {
        const leftKey = toLocalDateKey(left);
        const rightKey = toLocalDateKey(right);
        return leftKey !== "" && leftKey === rightKey;
    };
    const compareEventEntries = (left, right) => {
        const leftStart = left?.startDate?.getTime?.() || 0;
        const rightStart = right?.startDate?.getTime?.() || 0;
        if (leftStart !== rightStart) return leftStart - rightStart;
        const leftEnd = left?.endDate?.getTime?.() || 0;
        const rightEnd = right?.endDate?.getTime?.() || 0;
        if (leftEnd !== rightEnd) return leftEnd - rightEnd;
        return `${left?.event?.name || ""}`.localeCompare(`${right?.event?.name || ""}`);
    };
    const getCalendarEventEntries = eventsResponse => getEventsList(eventsResponse).map(event => {
            const startDate = toDateObject(getEventBoundary(event, "start"));
            const endDate = toDateObject(getEventBoundary(event, "end") || getEventBoundary(event, "start"));
            if (!startDate || !endDate) return null;
            const orderedStart = startDate <= endDate ? startDate : endDate;
            const orderedEnd = endDate >= startDate ? endDate : startDate;
            return {
                event,
                startDate: orderedStart,
                endDate: orderedEnd,
                startKey: toLocalDateKey(orderedStart),
                endKey: toLocalDateKey(orderedEnd)
            };
        }).filter(Boolean).sort(compareEventEntries);
    const getEventEntriesForDate = (eventEntries, date) => {
        const dateKey = toLocalDateKey(date);
        return eventEntries.filter(entry => isDateKeyInRange(dateKey, entry.startDate, entry.endDate));
    };
    const toTimeLabel = value => {
        const parsedDate = toDateObject(value);
        return parsedDate ? parsedDate.toLocaleTimeString([], {hour: "numeric", minute: "2-digit"}) : "";
    };
    const getEventTimeSummary = (eventEntry, date) => {
        const dateKey = toLocalDateKey(date);
        if (!dateKey || !eventEntry) return "";
        if (eventEntry.startKey === dateKey && eventEntry.endKey === dateKey) return `${toTimeLabel(eventEntry.startDate)} - ${toTimeLabel(eventEntry.endDate)}`;
        if (eventEntry.startKey === dateKey) return `Starts ${toTimeLabel(eventEntry.startDate)}`;
        if (eventEntry.endKey === dateKey) return `Until ${toTimeLabel(eventEntry.endDate)}`;
        return "All day";
    };
    const WEEKDAY_OPTIONS = [
        {value: "0", label: "Sun"},
        {value: "1", label: "Mon"},
        {value: "2", label: "Tue"},
        {value: "3", label: "Wed"},
        {value: "4", label: "Thu"},
        {value: "5", label: "Fri"},
        {value: "6", label: "Sat"}
    ];
    const MONTH_OPTIONS = [
        {value: "1", label: "Jan"},
        {value: "2", label: "Feb"},
        {value: "3", label: "Mar"},
        {value: "4", label: "Apr"},
        {value: "5", label: "May"},
        {value: "6", label: "Jun"},
        {value: "7", label: "Jul"},
        {value: "8", label: "Aug"},
        {value: "9", label: "Sep"},
        {value: "10", label: "Oct"},
        {value: "11", label: "Nov"},
        {value: "12", label: "Dec"}
    ];
    const ORDINAL_OPTIONS = [
        {value: "1", label: "first"},
        {value: "2", label: "second"},
        {value: "3", label: "third"},
        {value: "4", label: "fourth"},
        {value: "-1", label: "last"}
    ];
    const PATTERN_LABELS = {daily: "day", weekly: "week", monthly: "month", yearly: "year"};
    const clampNumber = (value, fallback, min, max) => {
        const parsed = Number(value);
        if (!Number.isFinite(parsed)) return fallback;
        return Math.min(max, Math.max(min, Math.trunc(parsed)));
    };
    const getLastDayOfMonth = (year, monthIndex) => new Date(year, monthIndex + 1, 0).getDate();
    const sameLocalDateTime = (left, right) => left && right && left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate() && left.getHours() === right.getHours() && left.getMinutes() === right.getMinutes();
    const copyTimeToDate = (date, source) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), source.getHours(), source.getMinutes(), source.getSeconds(), source.getMilliseconds());
    const addMonthsClamped = (date, months) => {
        const next = new Date(date.getFullYear(), date.getMonth() + months, 1, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
        next.setDate(Math.min(date.getDate(), getLastDayOfMonth(next.getFullYear(), next.getMonth())));
        return next;
    };
    const addYearsClamped = (date, years) => {
        const next = new Date(date.getFullYear() + years, date.getMonth(), 1, date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds());
        next.setDate(Math.min(date.getDate(), getLastDayOfMonth(next.getFullYear(), next.getMonth())));
        return next;
    };
    const getNthWeekdayOfMonth = (year, monthIndex, ordinal, weekday) => {
        if (ordinal === -1) {
            const last = new Date(year, monthIndex + 1, 0);
            const offset = (last.getDay() - weekday + 7) % 7;
            return new Date(year, monthIndex, last.getDate() - offset);
        }
        const first = new Date(year, monthIndex, 1);
        const offset = (weekday - first.getDay() + 7) % 7;
        const day = 1 + offset + ((ordinal - 1) * 7);
        if (day > getLastDayOfMonth(year, monthIndex)) return null;
        return new Date(year, monthIndex, day);
    };
    const getWeekRouteTitle = value => {
        const weekDates = getWeekDates(value);
        if (weekDates.length === 0) return "Week";
        const weekStart = weekDates[0];
        const weekEnd = weekDates[6];
        const sameMonth = weekStart.getMonth() === weekEnd.getMonth() && weekStart.getFullYear() === weekEnd.getFullYear();
        if (sameMonth) return `${weekStart.toLocaleDateString([], {month: "long"})} ${weekStart.getDate()}-${weekEnd.getDate()}, ${weekEnd.getFullYear()}`;
        return `${weekStart.toLocaleDateString([], {month: "short", day: "numeric", year: "numeric"})} - ${weekEnd.toLocaleDateString([], {month: "short", day: "numeric", year: "numeric"})}`;
    };
    const getDayRouteTitle = value => {
        const parsedDate = toDateObject(value);
        return parsedDate ? parsedDate.toLocaleDateString([], {weekday: "long", month: "long", day: "numeric", year: "numeric"}) : "Day";
    };
    let selectedCreateStartDateTime = null;
    let selectedCreateEndDateTime = null;
    const clearCreateEventDateTimeRange = () => {
        selectedCreateStartDateTime = null;
        selectedCreateEndDateTime = null;
    };
    const getCreateEventDateTimeRange = () => {
        const selectedStart = toDateObject(selectedCreateStartDateTime);
        const selectedEnd = toDateObject(selectedCreateEndDateTime);
        if (selectedStart && selectedEnd) {
            const ordered = getOrderedDateRange(selectedStart, selectedEnd);
            if (ordered.start && ordered.end) return ordered;
        }
        const {start, end} = getCreateEventDateRange();
        return {
            start: start ? new Date(start.getFullYear(), start.getMonth(), start.getDate(), 9, 0, 0, 0) : null,
            end: end ? new Date(end.getFullYear(), end.getMonth(), end.getDate(), 17, 0, 0, 0) : null
        };
    };
    const selectCalendarDate = (value, options = {}) => {
        const parsedDate = toDateObject(value);
        if (!parsedDate) return;
        const parsedEndDate = toDateObject(options.endDate ?? value) || parsedDate;
        selectedDate = parsedDate;
        selectedDateRangeStart = parsedDate;
        selectedDateRangeEnd = parsedEndDate;
        if (options.clearCreateTimeRange !== false) clearCreateEventDateTimeRange();
    };
    const openCreateEventPortalForDateTime = (start, end = null) => {
        const parsedStart = toDateObject(start);
        if (!parsedStart) return;
        const parsedEnd = toDateObject(end || new Date(parsedStart.getTime() + DAY_IN_MS)) || parsedStart;
        selectedCreateStartDateTime = parsedStart;
        selectedCreateEndDateTime = parsedEnd;
        selectedDate = parsedStart;
        selectedDateRangeStart = parsedStart;
        selectedDateRangeEnd = parsedStart;
        openCreateEventPortal();
    };
    const openSelectedEventPortal = (event, date = null) => {
        if (!event) return;
        if (date) selectCalendarDate(date);
        selectedEvent = event;
        modular.show("com.standard.calendar", 5);
    };
    window.StandardCalendar = window.StandardCalendar || {};
    window.StandardCalendar.openEvent = (event, date = null) => openSelectedEventPortal(event, date);
    const calendarEventPreviewEntries = new Map();
    let calendarEventPreviewIndex = 0;
    const buildCalendarEventPreview = () => {
        const preview = document.createElement("div");
        preview.className = "calendar-event-hover-preview";
        Object.assign(preview.style, {
            position: "fixed",
            display: "none",
            zIndex: "91100",
            width: "260px",
            maxWidth: "calc(100vw - 24px)",
            boxSizing: "border-box",
            padding: "10px",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius)",
            background: "var(--secondary-bg)",
            color: "var(--fg)",
            boxShadow: "var(--shadow)",
            pointerEvents: "none"
        });

        const title = document.createElement("div");
        title.className = "calendar-event-hover-preview-title";
        Object.assign(title.style, {
            fontWeight: "700",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            marginBottom: "6px"
        });

        const details = document.createElement("div");
        details.className = "calendar-event-hover-preview-details";
        Object.assign(details.style, {
            display: "grid",
            gap: "4px",
            fontSize: "calc(var(--fs) - 2px)"
        });

        ["time", "category", "start", "end"].forEach(field => {
            const row = document.createElement("div");
            row.className = `calendar-event-hover-preview-${field}`;
            Object.assign(row.style, {
                opacity: "0.82",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap"
            });
            details.appendChild(row);
        });

        preview.append(title, details);
        document.body.appendChild(preview);
        return preview;
    };
    const calendarEventPreview = {
        element: null,
        activeChip: null,
        pendingEvent: null,
        frame: null
    };
    const ensureCalendarEventPreview = () => {
        if (!calendarEventPreview.element || !document.body.contains(calendarEventPreview.element)) {
            calendarEventPreview.element = buildCalendarEventPreview();
        }
        return calendarEventPreview.element;
    };
    const updateCalendarEventPreviewContent = (eventEntry, date) => {
        const preview = ensureCalendarEventPreview();
        const event = eventEntry?.event || {};
        const setText = (selector, value, fallback = "") => {
            const element = preview.querySelector(selector);
            if (element) element.textContent = value || fallback;
        };
        const categoryName = event?.category?.name || "Uncategorized";
        const startLabel = toDateTimeLabel(getEventBoundary(event, "start")) || "Not set";
        const endLabel = toDateTimeLabel(getEventBoundary(event, "end")) || "Not set";
        setText(".calendar-event-hover-preview-title", event?.name || "Untitled");
        setText(".calendar-event-hover-preview-time", getEventTimeSummary(eventEntry, date), "Open");
        setText(".calendar-event-hover-preview-category", categoryName);
        setText(".calendar-event-hover-preview-start", `Start: ${startLabel}`);
        setText(".calendar-event-hover-preview-end", `End: ${endLabel}`);
        preview.style.borderColor = event?.category?.color || "var(--border)";
    };
    const moveCalendarEventPreview = event => {
        const preview = ensureCalendarEventPreview();
        const margin = 12;
        const offset = 16;
        let left = event.clientX + offset;
        let top = event.clientY + offset;
        const rect = preview.getBoundingClientRect();
        if (left + rect.width + margin > window.innerWidth) left = event.clientX - rect.width - offset;
        if (top + rect.height + margin > window.innerHeight) top = event.clientY - rect.height - offset;
        preview.style.left = `${Math.max(margin, left)}px`;
        preview.style.top = `${Math.max(margin, top)}px`;
    };
    const scheduleCalendarEventPreviewMove = event => {
        calendarEventPreview.pendingEvent = event;
        if (calendarEventPreview.frame) return;
        calendarEventPreview.frame = requestAnimationFrame(() => {
            calendarEventPreview.frame = null;
            if (!calendarEventPreview.pendingEvent) return;
            moveCalendarEventPreview(calendarEventPreview.pendingEvent);
        });
    };
    const showCalendarEventPreview = (chip, event) => {
        if (!chip) return;
        const previewData = calendarEventPreviewEntries.get(chip.id);
        if (!previewData) return;
        calendarEventPreview.activeChip = chip;
        updateCalendarEventPreviewContent(previewData.eventEntry, previewData.date);
        const preview = ensureCalendarEventPreview();
        preview.style.display = "block";
        moveCalendarEventPreview(event);
    };
    const hideCalendarEventPreview = () => {
        if (calendarEventPreview.frame) cancelAnimationFrame(calendarEventPreview.frame);
        calendarEventPreview.frame = null;
        calendarEventPreview.pendingEvent = null;
        calendarEventPreview.activeChip = null;
        if (calendarEventPreview.element) calendarEventPreview.element.style.display = "none";
    };
    document.addEventListener("mouseover", event => {
        const chip = event.target.closest?.(".calendar-event-chip");
        if (!chip || chip === calendarEventPreview.activeChip) return;
        showCalendarEventPreview(chip, event);
    });
    document.addEventListener("mousemove", event => {
        if (!calendarEventPreview.activeChip) return;
        const chip = event.target.closest?.(".calendar-event-chip");
        if (chip !== calendarEventPreview.activeChip) return;
        scheduleCalendarEventPreviewMove(event);
    });
    document.addEventListener("mouseout", event => {
        if (!calendarEventPreview.activeChip) return;
        const relatedTarget = event.relatedTarget;
        if (relatedTarget instanceof Node && calendarEventPreview.activeChip.contains(relatedTarget)) return;
        const leavingChip = event.target.closest?.(".calendar-event-chip");
        if (leavingChip === calendarEventPreview.activeChip) hideCalendarEventPreview();
    });
    window.addEventListener("blur", hideCalendarEventPreview);
    window.addEventListener("scroll", hideCalendarEventPreview, true);
    const renderCalendarEventChip = (eventEntry, date, options = {}) => {
        const categoryColor = eventEntry?.event?.category?.color || "#7B61FF";
        const eventName = eventEntry?.event?.name || "Untitled";
        const timeSummary = getEventTimeSummary(eventEntry, date);
        const previewId = `calendar-event-chip-${calendarEventPreviewIndex++}`;
        calendarEventPreviewEntries.set(previewId, {eventEntry, date});
        return div({
            id: previewId,
            style: `${options.compact ? "tiny-text" : ""} calendar-event-chip small-padding inner-radius text-white pointer hover-shadowed`,
            background: categoryColor,
            title: `${eventName}${timeSummary ? `\n${timeSummary}` : ""}`,
            content: children([
                div({style: "strong truncate", content: eventName}),
                div({style: "tiny-text text-white", content: timeSummary || "Open"})
            ]),
            oncontextmenu: e => {
                e.preventDefault();
                e.stopPropagation();
            },
            onclick: e => {
                e.preventDefault();
                e.stopPropagation();
                openSelectedEventPortal(eventEntry.event, date);
            }
        });
    };
    const buildCalendarRangeControls = ({previous, next, label}) => div({
        style: "line small-padding-bottom",
        content: children([
            button({style: "naked tiny secondary", icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>`, onclick: previous}),
            button({style: "naked tiny secondary", icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M7.5 3.75H6A2.25 2.25 0 0 0 3.75 6v1.5M16.5 3.75H18A2.25 2.25 0 0 1 20.25 6v1.5m0 9V18A2.25 2.25 0 0 1 18 20.25h-1.5m-9 0H6A2.25 2.25 0 0 1 3.75 18v-1.5M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>`, onclick: () => {
                    selectToday();
                    refreshMainCalendarPortal();
                }}),
            button({style: "naked tiny secondary", icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="small-icon"><path stroke-linecap="round" stroke-linejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" /></svg>`, onclick: next}),
            div({style: "float-right strong small-padding-top", content: label})
        ])
    });
    const openCreateEventPortal = () => {
        setCalendarPortalTitle(4, getCreateEventPortalTitle());
        modular.show("com.standard.calendar", 4);
    };
    const selectToday = () => {
        selectCalendarDate(new Date());
    };
    const withOpenCalendarPortals = (callback, portalIndexes = null) => {
        const allowedPortalIndexes = portalIndexes === null ? null : new Set((Array.isArray(portalIndexes) ? portalIndexes : [portalIndexes]).map(index => Number(index)));
        document.querySelectorAll(".draggable-window").forEach(windowDiv => {
            const portal = windowDiv?.portal;
            if (!portal || typeof portal.serviceId !== "function" || typeof portal.portalIndex !== "function") return;
            if (portal.serviceId() !== "com.standard.calendar") return;
            if (allowedPortalIndexes && !allowedPortalIndexes.has(portal.portalIndex())) return;
            callback(portal, windowDiv);
        });
    };
    const withCalendarPortal = (portalIndex, callback) => {
        withOpenCalendarPortals(callback, portalIndex);
    };
    const hideCalendarPortal = portalIndex => {
        withCalendarPortal(portalIndex, portal => {
            if (typeof portal.hide === "function") portal.hide();
        });
    };
    const refreshCalendarPortals = (...portalIndexes) => {
        const normalizedIndexes = portalIndexes.length === 0 ? null : portalIndexes;
        withOpenCalendarPortals(portal => {
            if (typeof portal.refresh === "function") portal.refresh();
        }, normalizedIndexes);
    };
    const setCalendarPortalTitle = (portalIndex, title) => {
        const nextTitle = `${title || ""}`.trim() || "Untitled";
        withCalendarPortal(portalIndex, (_, windowDiv) => {
            const headerTitle = windowDiv?.querySelector(".window-header .title");
            if (headerTitle) headerTitle.textContent = nextTitle;
        });
    };
    const getLastCalendarPortalWindow = portalIndex => {
        let matchingWindow = null;
        withCalendarPortal(portalIndex, (_, windowDiv) => {
            matchingWindow = windowDiv;
        });
        return matchingWindow;
    };
    const getScrollableAncestor = element => {
        let current = element?.parentElement || null;
        while (current) {
            const style = window.getComputedStyle(current);
            const overflowY = style?.overflowY || "";
            if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight) return current;
            current = current.parentElement;
        }
        return null;
    };
    const scrollChildIntoContainerView = (container, child) => {
        if (!container || !child) return;
        const containerRect = container.getBoundingClientRect();
        const childRect = child.getBoundingClientRect();
        const isOutOfView = childRect.top < containerRect.top || childRect.bottom > containerRect.bottom;
        if (!isOutOfView) return;
        const targetScrollTop = container.scrollTop + (childRect.top - containerRect.top) - ((container.clientHeight - childRect.height) / 2);
        const nextScrollTop = Math.max(0, targetScrollTop);
        if (typeof container.scrollTo === "function") {
            container.scrollTo({top: nextScrollTop, behavior: "smooth"});
            return;
        }
        container.scrollTop = nextScrollTop;
    };
    const scrollTileIntoViewWhenReady = (container, selector, attempts = 24) => {
        if (!container || attempts <= 0) return;
        const tile = container.querySelector(selector);
        if (!tile) {
            requestAnimationFrame(() => scrollTileIntoViewWhenReady(container, selector, attempts - 1));
            return;
        }
        const scrollContainer = container.closest(".window-body") || getScrollableAncestor(container) || container;
        scrollChildIntoContainerView(scrollContainer, tile);
    };
    const refreshMainCalendarPortal = () => refreshCalendarPortals(0);
    const disposePortalAndRefreshCalendar = portalIndex => {
        hideCalendarPortal(portalIndex);
        refreshMainCalendarPortal();
    };
    const deleteSelectedEvent = portalIndex => {
        const eventId = `${selectedEvent?.id || ""}`.trim();
        if (eventId === "") return;
        confirmationDialogue({title: "Delete Event", content: "You're sure you want to delete this event?", confirmation: () => {
                CLI.send(`[events] - <id ${eventId}>`).then(response => {
                    if (response !== 1) return;
                    selectedEvent = null;
                    disposePortalAndRefreshCalendar(portalIndex);
                });
            }
        });
    };
    const deleteSelectedCategory = portalIndex => {
        const categoryId = `${selectedCategory?.id || ""}`.trim();
        if (categoryId === "") return;
        confirmationDialogue({title: "Delete Category", content: "You're sure you want to delete this category?", confirmation: () => {
                CLI.send(`[cats] - <id ${categoryId}>`).then(response => {
                    if (response !== 1) return;
                    selectedCategory = null;
                    hideCalendarPortal(portalIndex);
                    refreshCalendarPortals(1);
                    refreshMainCalendarPortal();
                });
            }
        });
    };
    const saveSelectedCategory = portalIndex => {
        const categoryId = `${selectedCategory?.id || ""}`.trim();
        const name = (document.getElementById("edit-calendar-category-name")?.value || "").trim();
        const color = (document.getElementById("edit-calendar-category-color")?.value || "").trim();
        if (categoryId === "" || name === "" || color === "") return;
        const escapedName = escapeQuotedValue(name);
        const escapedColor = escapeQuotedValue(color);
        Promise.all([
            CLI.send(`[cats] name "${escapedName}" <id ${categoryId}>`),
            CLI.send(`[cats] color "${escapedColor}" <id ${categoryId}>`)
        ]).then(responses => {
            if (responses.every(response => response !== 0)) {
                selectedCategory = {...selectedCategory, name, color};
                refreshCalendarPortals(1);
                refreshMainCalendarPortal();
                hideCalendarPortal(portalIndex);
            }
        });
    };
    const recurrencePrefix = portalIndex => portalIndex === 6 ? "edit" : "create";
    const getRecurrenceField = (prefix, id) => document.getElementById(`${prefix}-recurrence-${id}`);
    const getSelectedRecurrenceWeekdays = (prefix, fallbackDay = new Date().getDay()) => {
        const selected = Array.from(document.querySelectorAll(`[data-recurrence-prefix="${prefix}"][data-recurrence-weekday]:checked`)).map(input => Number(input.value)).filter(value => Number.isFinite(value));
        return selected.length > 0 ? selected : [fallbackDay];
    };
    const getRecurrenceSettingsFromPortal = (portalIndex, baseStart) => {
        const prefix = recurrencePrefix(portalIndex);
        if (getRecurrenceField(prefix, "enabled")?.checked !== true) return {enabled: false};
        const pattern = getRecurrenceField(prefix, "pattern")?.value || "weekly";
        const interval = clampNumber(getRecurrenceField(prefix, "interval")?.value, 1, 1, 999);
        const occurrences = clampNumber(getRecurrenceField(prefix, "occurrences")?.value, 10, 1, 365);
        const dayOfMonth = clampNumber(getRecurrenceField(prefix, "month-day")?.value, baseStart.getDate(), 1, 31);
        const monthOrdinal = clampNumber(getRecurrenceField(prefix, "month-ordinal")?.value, 1, -1, 4);
        const monthWeekday = clampNumber(getRecurrenceField(prefix, "month-weekday")?.value, baseStart.getDay(), 0, 6);
        const yearlyMonth = clampNumber(getRecurrenceField(prefix, "year-month")?.value, baseStart.getMonth() + 1, 1, 12);
        const yearlyDay = clampNumber(getRecurrenceField(prefix, "year-day")?.value, baseStart.getDate(), 1, 31);
        return {
            enabled: true,
            pattern,
            interval,
            occurrences,
            weekdays: getSelectedRecurrenceWeekdays(prefix, baseStart.getDay()),
            monthlyMode: getRecurrenceField(prefix, "month-mode")?.value || "day",
            dayOfMonth,
            monthOrdinal,
            monthWeekday,
            yearlyMonth,
            yearlyDay
        };
    };
    const buildEventOccurrence = (startDate, durationMs) => {
        const endDate = new Date(startDate.getTime() + durationMs);
        return {
            start: toTimestampString(toDateTimeLocalValue(startDate, startDate.getHours(), startDate.getMinutes())),
            end: toTimestampString(toDateTimeLocalValue(endDate, endDate.getHours(), endDate.getMinutes()))
        };
    };
    const calculateRecurringEventOccurrences = (baseStart, baseEnd, recurrence, options = {}) => {
        if (!recurrence?.enabled) return [buildEventOccurrence(baseStart, baseEnd.getTime() - baseStart.getTime())];
        const durationMs = Math.max(0, baseEnd.getTime() - baseStart.getTime());
        const occurrences = [];
        const addCandidate = candidate => {
            if (!candidate || candidate < baseStart) return;
            if (options.skipBase && sameLocalDateTime(candidate, baseStart)) return;
            if (occurrences.some(existing => sameLocalDateTime(existing, candidate))) return;
            occurrences.push(candidate);
        };
        if (recurrence.pattern === "daily") {
            const selectedWeekdays = new Set(recurrence.weekdays);
            for (let offset = 0; occurrences.length < recurrence.occurrences && offset < recurrence.occurrences * recurrence.interval * 14; offset += 1) {
                if (offset % recurrence.interval !== 0) continue;
                const candidate = new Date(baseStart.getFullYear(), baseStart.getMonth(), baseStart.getDate() + offset, baseStart.getHours(), baseStart.getMinutes(), 0, 0);
                if (selectedWeekdays.has(candidate.getDay())) addCandidate(candidate);
            }
        } else if (recurrence.pattern === "weekly") {
            const selectedWeekdays = [...new Set(recurrence.weekdays)].sort((left, right) => left - right);
            const baseWeek = getStartOfWeek(baseStart) || baseStart;
            for (let weekOffset = 0; occurrences.length < recurrence.occurrences && weekOffset < recurrence.occurrences * recurrence.interval * 8; weekOffset += recurrence.interval) {
                selectedWeekdays.forEach(weekday => {
                    const candidateDate = new Date(baseWeek.getFullYear(), baseWeek.getMonth(), baseWeek.getDate() + weekOffset * 7 + weekday);
                    addCandidate(copyTimeToDate(candidateDate, baseStart));
                });
            }
        } else if (recurrence.pattern === "monthly") {
            for (let monthOffset = 0; occurrences.length < recurrence.occurrences && monthOffset < recurrence.occurrences * recurrence.interval * 3; monthOffset += recurrence.interval) {
                const monthSeed = addMonthsClamped(baseStart, monthOffset);
                let candidateDate = null;
                if (recurrence.monthlyMode === "weekday") {
                    candidateDate = getNthWeekdayOfMonth(monthSeed.getFullYear(), monthSeed.getMonth(), recurrence.monthOrdinal, recurrence.monthWeekday);
                } else {
                    candidateDate = new Date(monthSeed.getFullYear(), monthSeed.getMonth(), Math.min(recurrence.dayOfMonth, getLastDayOfMonth(monthSeed.getFullYear(), monthSeed.getMonth())));
                }
                addCandidate(candidateDate ? copyTimeToDate(candidateDate, baseStart) : null);
            }
        } else if (recurrence.pattern === "yearly") {
            for (let yearOffset = 0; occurrences.length < recurrence.occurrences && yearOffset < recurrence.occurrences * recurrence.interval * 2; yearOffset += recurrence.interval) {
                const yearSeed = addYearsClamped(baseStart, yearOffset);
                const monthIndex = recurrence.yearlyMonth - 1;
                const candidateDate = new Date(yearSeed.getFullYear(), monthIndex, Math.min(recurrence.yearlyDay, getLastDayOfMonth(yearSeed.getFullYear(), monthIndex)));
                addCandidate(copyTimeToDate(candidateDate, baseStart));
            }
        }
        return occurrences.slice(0, recurrence.occurrences).map(startDate => buildEventOccurrence(startDate, durationMs));
    };
    const createEventRecord = ({owner, category, name, start, end}) => {
        const escapedName = escapeQuotedValue(name);
        const escapedStart = escapeQuotedValue(start);
        const escapedEnd = escapeQuotedValue(end);
        return CLI.send(`[events] + (@${owner}, @${category}, "${escapedName}", "${escapedStart}", "${escapedEnd}", [], [])`, false);
    };
    const isSuccessfulCalendarWrite = response => {
        const normalizedResponse = `${response ?? ""}`.trim();
        return normalizedResponse !== "" && normalizedResponse !== "0";
    };
    const buildWeekdaySelector = (prefix, selectedDays) => div({
        style: "calendar-recurrence-weekdays",
        content: children(WEEKDAY_OPTIONS.map(day => label({
            style: "calendar-recurrence-day",
            content: children([
                input({
                    type: "checkbox",
                    style: "calendar-recurrence-day-input",
                    value: day.value,
                    checked: selectedDays.includes(Number(day.value))
                }).replace("<input ", `<input data-recurrence-prefix="${prefix}" data-recurrence-weekday `),
                div({style: "calendar-recurrence-day-label", content: day.label})
            ])
        })))
    });
    const buildRecurrenceControls = (prefix, baseStart) => {
        const startDate = toDateObject(baseStart) || new Date();
        const selectedWeekday = startDate.getDay();
        const dayOfMonth = startDate.getDate();
        return div({style: "calendar-recurrence-shell", content: children([
            div({style: "calendar-recurrence-switch-row padded", content: children([
                div({style: "bold small-padding-top", content: "Reoccurring"}),
                switcher({id: `${prefix}-recurrence-enabled`, checked: false})
            ])}),
            div({style: "calendar-recurrence-panel calendar-recurrence-panel-closed", id: `${prefix}-recurrence-panel`, content: children([
                div({style: "faded small-padding bold", content: "Reoccurrence pattern"}),
                div({style: "padded", content: select({
                    id: `${prefix}-recurrence-pattern`,
                    value: "weekly",
                    options: [
                        {value: "daily", label: "Daily"},
                        {value: "weekly", label: "Weekly"},
                        {value: "monthly", label: "Monthly"},
                        {value: "yearly", label: "Yearly"}
                    ]
                })}),
                div({style: "calendar-recurrence-row padded", content: children([
                    label({style: "calendar-recurrence-inline-label", input: `${prefix}-recurrence-interval`, content: "Recur every"}),
                    input({id: `${prefix}-recurrence-interval`, type: "number", value: "1", style: "calendar-recurrence-number", placeholder: "1"}),
                    div({style: "calendar-recurrence-unit", id: `${prefix}-recurrence-unit`, content: "week(s) on:"})
                ])}),
                div({style: "calendar-recurrence-weekday-section", id: `${prefix}-recurrence-weekday-section`, content: buildWeekdaySelector(prefix, [selectedWeekday])}),
                div({style: "calendar-recurrence-monthly-section", id: `${prefix}-recurrence-monthly-section`, content: children([
                    div({style: "calendar-recurrence-radio-row", content: children([
                        label({style: "calendar-recurrence-radio-label", content: children([
                            input({type: "radio", name: `${prefix}-recurrence-month-mode`, id: `${prefix}-recurrence-month-mode-day`, value: "day", checked: true}).replace("<input ", `<input data-recurrence-month-mode="${prefix}" `),
                            "Day"
                        ])}),
                        input({id: `${prefix}-recurrence-month-day`, type: "number", value: `${dayOfMonth}`, style: "calendar-recurrence-number", placeholder: `${dayOfMonth}`})
                    ])}),
                    div({style: "calendar-recurrence-radio-row", content: children([
                        label({style: "calendar-recurrence-radio-label", content: children([
                            input({type: "radio", name: `${prefix}-recurrence-month-mode`, id: `${prefix}-recurrence-month-mode-weekday`, value: "weekday"}).replace("<input ", `<input data-recurrence-month-mode="${prefix}" `),
                            "The"
                        ])}),
                        select({id: `${prefix}-recurrence-month-ordinal`, value: "1", options: ORDINAL_OPTIONS}),
                        select({id: `${prefix}-recurrence-month-weekday`, value: `${selectedWeekday}`, options: WEEKDAY_OPTIONS.map(option => ({value: option.value, label: option.label}))})
                    ])}),
                    input({type: "hidden", id: `${prefix}-recurrence-month-mode`, value: "day"})
                ])}),
                div({style: "calendar-recurrence-yearly-section", id: `${prefix}-recurrence-yearly-section`, content: children([
                    div({style: "calendar-recurrence-row", content: children([
                        select({id: `${prefix}-recurrence-year-month`, value: `${startDate.getMonth() + 1}`, options: MONTH_OPTIONS}),
                        input({id: `${prefix}-recurrence-year-day`, type: "number", value: `${dayOfMonth}`, style: "calendar-recurrence-number", placeholder: `${dayOfMonth}`})
                    ])})
                ])}),
                div({style: "calendar-recurrence-row padded", content: children([
                    label({style: "calendar-recurrence-inline-label", input: `${prefix}-recurrence-occurrences`, content: "Occurrences"}),
                    input({id: `${prefix}-recurrence-occurrences`, type: "number", value: "10", style: "calendar-recurrence-number", placeholder: "10"})
                ])})
            ])})
        ])});
    };
    const bindRecurrenceControls = (prefix, startInput = null) => {
        const enabledInput = getRecurrenceField(prefix, "enabled");
        const panel = getRecurrenceField(prefix, "panel");
        const patternSelect = getRecurrenceField(prefix, "pattern");
        const unit = getRecurrenceField(prefix, "unit");
        const weekdaySection = getRecurrenceField(prefix, "weekday-section");
        const monthlySection = getRecurrenceField(prefix, "monthly-section");
        const yearlySection = getRecurrenceField(prefix, "yearly-section");
        if (!enabledInput || !panel || !patternSelect) return;
        if (panel.dataset.recurrenceBound === "true") return;
        panel.dataset.recurrenceBound = "true";
        const windowNode = panel.closest(".draggable-window");
        if (windowNode && !windowNode.dataset.calendarRecurrenceBaseHeight) {
            windowNode.dataset.calendarRecurrenceBaseHeight = `${Math.ceil(windowNode.getBoundingClientRect().height || windowNode.offsetHeight || 0)}`;
        }
        const updatePattern = () => {
            const pattern = patternSelect.value || "weekly";
            if (unit) unit.textContent = `${PATTERN_LABELS[pattern] || "week"}(s) on:`;
            if (weekdaySection) weekdaySection.style.display = pattern === "daily" || pattern === "weekly" ? "block" : "none";
            if (monthlySection) monthlySection.style.display = pattern === "monthly" ? "block" : "none";
            if (yearlySection) yearlySection.style.display = pattern === "yearly" ? "block" : "none";
        };
        let closeTimer = null;
        const setWindowExpanded = expanded => {
            const targetWindow = panel.closest(".draggable-window");
            if (!targetWindow) return;
            const baseHeight = Number.parseFloat(targetWindow.dataset.calendarRecurrenceBaseHeight || "");
            if (!Number.isFinite(baseHeight) || baseHeight <= 0) return;
            targetWindow.style.transition = "height .28s ease";
            if (expanded) {
                targetWindow.style.height = `${baseHeight + panel.scrollHeight + 12}px`;
                return;
            }
            targetWindow.style.height = `${baseHeight}px`;
        };
        const updateEnabled = () => {
            const expanded = enabledInput.checked === true;
            if (closeTimer) {
                clearTimeout(closeTimer);
                closeTimer = null;
            }
            if (expanded) {
                panel.classList.remove("calendar-recurrence-panel-closed");
                panel.classList.add("open");
                requestAnimationFrame(() => setWindowExpanded(true));
                return;
            }
            setWindowExpanded(false);
            panel.classList.remove("open");
            closeTimer = setTimeout(() => {
                if (enabledInput.checked === true) return;
                panel.classList.add("calendar-recurrence-panel-closed");
                closeTimer = null;
            }, 280);
        };
        enabledInput.addEventListener("change", updateEnabled);
        patternSelect.addEventListener("change", () => {
            updatePattern();
            if (enabledInput.checked === true) requestAnimationFrame(() => setWindowExpanded(true));
        });
        document.querySelectorAll(`[data-recurrence-month-mode="${prefix}"]`).forEach(inputNode => {
            inputNode.addEventListener("change", () => {
                if (inputNode.checked) getRecurrenceField(prefix, "month-mode").value = inputNode.value;
            });
        });
        startInput?.addEventListener("change", () => {
            const startDate = toDateObject(startInput.value);
            if (!startDate) return;
            const dayInput = getRecurrenceField(prefix, "month-day");
            const yearDayInput = getRecurrenceField(prefix, "year-day");
            if (dayInput) dayInput.value = `${startDate.getDate()}`;
            if (yearDayInput) yearDayInput.value = `${startDate.getDate()}`;
        });
        updatePattern();
        updateEnabled();
    };
    const createEventFromPortal = portalIndex => {
        const owner = `${modular.user.id()}`.trim();
        const categoryInput = document.getElementById("event-category");
        const category = normalizeRecordId((document.getElementById("event-category-id")?.value || "") || (categoryInput?.getAttribute("data-searchbox-selected-value") || ""));
        const name = (document.getElementById("event-name")?.value || "").trim();
        const startValue = (document.getElementById("start-timestamp")?.value || "").trim();
        const endValue = (document.getElementById("end-timestamp")?.value || "").trim();
        const startDate = toDateObject(startValue);
        const endDate = toDateObject(endValue);
        if (owner === "" || category === "" || name === "" || !startDate || !endDate) return;
        const recurrence = getRecurrenceSettingsFromPortal(portalIndex, startDate);
        const occurrences = calculateRecurringEventOccurrences(startDate, endDate, recurrence);
        Promise.all(occurrences.map(occurrence => createEventRecord({owner, category, name, start: occurrence.start, end: occurrence.end}))).then(createResponses => {
            const createdAll = createResponses.every(isSuccessfulCalendarWrite);
            if (createdAll) {
                refreshCalendarPortals();
                hideCalendarPortal(portalIndex);
                return;
            }
            modular.error("Failed to create event");
        }).catch(() => {
            modular.error("Failed to create event");
        });
    };
    const saveSelectedEvent = portalIndex => {
        const eventId = `${selectedEvent?.id || ""}`.trim();
        const name = (document.getElementById("edit-event-name")?.value || "").trim();
        const categoryInput = document.getElementById("edit-event-category");
        const category = normalizeRecordId((document.getElementById("edit-event-category-id")?.value || "") || (categoryInput?.getAttribute("data-searchbox-selected-value") || ""));
        const startValue = (document.getElementById("edit-start-timestamp")?.value || "").trim();
        const endValue = (document.getElementById("edit-end-timestamp")?.value || "").trim();
        const startDate = toDateObject(startValue);
        const endDate = toDateObject(endValue);
        const start = toTimestampString(startValue);
        const end = toTimestampString(endValue);
        if (eventId === "" || name === "" || category === "" || start === "" || end === "" || !startDate || !endDate) return;
        const escapedName = escapeQuotedValue(name);
        const escapedStart = escapeQuotedValue(start);
        const escapedEnd = escapeQuotedValue(end);
        const owner = `${modular.user.id()}`.trim();
        const recurrence = getRecurrenceSettingsFromPortal(portalIndex, startDate);
        const extraOccurrences = calculateRecurringEventOccurrences(startDate, endDate, recurrence, {skipBase: true});
        if (extraOccurrences.length > 0 && owner === "") return;
        Promise.all([
            CLI.send(`[events] name "${escapedName}" <id ${eventId}>`),
            CLI.send(`[events] category ${category} <id ${eventId}>`),
            CLI.send(`[events] start "${escapedStart}" <id ${eventId}>`),
            CLI.send(`[events] end "${escapedEnd}" <id ${eventId}>`),
            ...extraOccurrences.map(occurrence => createEventRecord({owner, category, name, start: occurrence.start, end: occurrence.end}))
        ]).then(responses => {
            if (responses.every(isSuccessfulCalendarWrite)) {
                selectedEvent = {
                    ...selectedEvent,
                    name,
                    category: eventCategoryLookup[`${category}`] || selectedEvent.category,
                    start,
                    end
                };
                refreshCalendarPortals();
                hideCalendarPortal(portalIndex);
                refreshCalendarPortals(5);
            }
        });
    };
    const eventCategoryLookup = {};
    let selectedEvent = null;
    let selectedCategory = null;
    window.StandardCalendar.openCategories = () => modular.show("com.standard.calendar", 1);
    const currentDate = new Date();
    const currentMonthLabel = currentDate.toLocaleString('default', { month: 'long' });
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();
    const currentDay = currentDate.getDate();
    let selectedDate = new Date(currentYear, currentMonth, currentDay);
    let selectedDateRangeStart = selectedDate;
    let selectedDateRangeEnd = selectedDate;
    let disposeRangeSelectionListeners = () => {};
    const yearStart = new Date(currentYear, 0, 1);
    const daysInYear = Math.round((new Date(currentYear + 1, 0, 1) - yearStart) / 86400000);
    const weekdayLabels = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    modular.register(new Service("com.standard.calendar", [
        new Portal({
            title: `${currentMonthLabel} ${currentYear}`,
            hints: ["calendar", "events"],
            dimensions: [1020, 605],
            horizontal_nav: true,
            centered_nav: true,
            tools: [{
                title: "New Event",
                icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`,
                onclick: _ => {
                    selectToday();
                    openCreateEventPortal();
                }
            }, {
                title: "Categories",
                icon: `<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><style>.s0{fill:none;stroke:#000000;stroke-linecap:round;stroke-linejoin:round;stroke-width: 1 } </style><path class="s0" d="m10 5h-3.29q-0.34 0-0.65 0.13-0.32 0.13-0.56 0.37-0.24 0.24-0.37 0.56-0.13 0.31-0.13 0.65v3.29c0 0.45 0.18 0.89 0.5 1.21l7.3 7.3c0.53 0.53 1.35 0.66 1.98 0.25q0.59-0.39 1.14-0.84 0.55-0.45 1.05-0.95 0.5-0.5 0.95-1.05 0.45-0.55 0.84-1.14c0.41-0.63 0.28-1.45-0.25-1.98l-7.3-7.3q-0.12-0.12-0.26-0.21-0.14-0.09-0.29-0.16-0.16-0.06-0.33-0.1-0.16-0.03-0.33-0.03z"/><path class="s0" d="m7.28 7.28h0.01v0.01h-0.01z"/></svg>`,
                onclick: () => modular.show("com.standard.calendar", 1)
            }],
            svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" /></svg>`,
            icon: "/icons/interfaces/calendar.png",
            routes: [
                {
                    text: "Month",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 48 48"><path d="M 12.5 6 C 8.9280619 6 6 8.9280619 6 12.5 L 6 35.5 C 6 39.071938 8.9280619 42 12.5 42 L 35.5 42 C 39.071938 42 42 39.071938 42 35.5 L 42 12.5 C 42 8.9280619 39.071938 6 35.5 6 L 12.5 6 z M 12.5 9 L 35.5 9 C 37.450062 9 39 10.549938 39 12.5 L 39 35.5 C 39 37.450062 37.450062 39 35.5 39 L 12.5 39 C 10.549938 39 9 37.450062 9 35.5 L 9 12.5 C 9 10.549938 10.549938 9 12.5 9 z M 15.5 17 A 2.5 2.5 0 0 0 15.5 22 A 2.5 2.5 0 0 0 15.5 17 z M 24 17 A 2.5 2.5 0 0 0 24 22 A 2.5 2.5 0 0 0 24 17 z M 32.5 17 A 2.5 2.5 0 0 0 32.5 22 A 2.5 2.5 0 0 0 32.5 17 z M 15.5 27 A 2.5 2.5 0 0 0 15.5 32 A 2.5 2.5 0 0 0 15.5 27 z M 24 27 A 2.5 2.5 0 0 0 24 32 A 2.5 2.5 0 0 0 24 27 z"/></svg>`,
                    route: () => {
                        setCalendarPortalTitle(0, `${currentMonthLabel} ${currentYear}`);
                        return div({style: "grid7 no-scrollbars larger-padding-top", id: "", content: () => CLI.send("[events]").then(eventsResponse => {
                            const eventsByDate = {};
                            getCalendarEventEntries(eventsResponse).forEach(eventEntry => {
                                const iterDate = new Date(eventEntry.startDate.getFullYear(), eventEntry.startDate.getMonth(), eventEntry.startDate.getDate());
                                const lastDate = new Date(eventEntry.endDate.getFullYear(), eventEntry.endDate.getMonth(), eventEntry.endDate.getDate());
                                while (iterDate <= lastDate) {
                                    const dateKey = toLocalDateKey(iterDate);
                                    if (!eventsByDate[dateKey]) eventsByDate[dateKey] = [];
                                    eventsByDate[dateKey].push(eventEntry);
                                    iterDate.setDate(iterDate.getDate() + 1);
                                }
                            });
                            let ch = [];
                            for (let i = 0; i < daysInYear; i++) {
                                const tileDate = new Date(currentYear, 0, i + 1);
                                const weekdayLabel = weekdayLabels[tileDate.getDay()];
                                const dayOfYear = i + 1;
                                const isToday = (tileDate.getMonth() === currentMonth && tileDate.getDate() === currentDay);
                                const tileEvents = eventsByDate[toLocalDateKey(tileDate)] || [];
                                ch.push(div({
                                    data: toLocalDateKey(tileDate),
                                    style: "no-background bordered radius shadowed hover-zoom pointer" + (isToday ? " primary-border text-primary faded-background-primary calendar-day--today" : ""),
                                    content: children([
                                        div({style: "center strong small-padding tiny-text text-primary", content: tileDate.toLocaleString('default', { month: 'short' })}),
                                        div({style: "align-top", content: children([
                                                div({style: "float-right faded small-padding-right align-top", content: children([
                                                        div({style: "super-tiny-text inline small-padding-right align-top", content: dayOfYear}),
                                                        div({style: "tiny-text inline small-padding-right align-top", content: weekdayLabel}),
                                                    ])
                                                }),
                                                div({style: "strong inline small-padding-left faded align-top", content: tileDate.getDate()}),
                                            ])
                                        }),
                                        div({style: "small-padding-left small-padding-right small-padding-bottom", content: children(tileEvents.map(eventEntry => {
                                                const event = eventEntry?.event || {};
                                                const categoryColor = event?.category?.color || "#7B61FF";
                                                const eventName = event?.name || "Untitled";
                                                const timeSummary = getEventTimeSummary(eventEntry, tileDate);
                                                const previewId = `calendar-event-chip-${calendarEventPreviewIndex++}`;
                                                calendarEventPreviewEntries.set(previewId, {eventEntry, date: tileDate});
                                                return div({
                                                    id: previewId,
                                                    style: "calendar-event-chip tiny-text small-padding inner-radius text-white truncate pointer",
                                                    background: categoryColor,
                                                    title: `${eventName}${timeSummary ? `\n${timeSummary}` : ""}`,
                                                    content: eventName,
                                                    oncontextmenu: e => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                    },
                                                    onclick: e => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        selectedEvent = event;
                                                        modular.show("com.standard.calendar", 5);
                                                    }
                                                });
                                            }))
                                        })
                                    ])
                                }))
                            }
                            return children(ch);
                        })
                    })},
                    afterRender: () => {
                        const options = [
                            {
                                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 11C14.2386 11 12 13.2386 12 16C12 18.7614 14.2386 21 17 21C19.7614 21 22 18.7614 22 16C22 13.2386 19.7614 11 17 11ZM17 11V9M2 9V15.8C2 16.9201 2 17.4802 2.21799 17.908C2.40973 18.2843 2.71569 18.5903 3.09202 18.782C3.51984 19 4.0799 19 5.2 19H13M2 9V8.2C2 7.0799 2 6.51984 2.21799 6.09202C2.40973 5.71569 2.71569 5.40973 3.09202 5.21799C3.51984 5 4.0799 5 5.2 5H13.8C14.9201 5 15.4802 5 15.908 5.21799C16.2843 5.40973 16.5903 5.71569 16.782 6.09202C17 6.51984 17 7.0799 17 8.2V9M2 9H17M5 3V5M14 3V5M15 16H17M17 16H19M17 16V14M17 16V18" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
                                label: "Add Event",
                                action: (_, __, target) => {
                                    updateSelectedDateFromTarget(target);
                                    openCreateEventPortal();
                                }
                            }, {
                                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 17V9M16 13.0011L8 13M7 3V5M17 3V5M6.2 21H17.8C18.9201 21 19.4802 21 19.908 20.782C20.2843 20.5903 20.5903 20.2843 20.782 19.908C21 19.4802 21 18.9201 21 17.8V8.2C21 7.07989 21 6.51984 20.782 6.09202C20.5903 5.71569 20.2843 5.40973 19.908 5.21799C19.4802 5 18.9201 5 17.8 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
                                label: "Categories",
                                action: () => modular.show("com.standard.calendar", 1)
                            }
                        ];
                        const calendarGrid = getLastCalendarPortalWindow(0)?.querySelector(".grid7") || document.querySelector(".grid7");
                        if (!calendarGrid) return;
                        disposeRangeSelectionListeners();
                        const applyRangeSelectionToGrid = () => {
                            const {start, end} = getOrderedDateRange(selectedDateRangeStart, selectedDateRangeEnd);
                            calendarGrid.querySelectorAll("[data]").forEach(tile => {
                                const dateKey = tile.getAttribute("data") || "";
                                const isSelected = isDateKeyInRange(dateKey, start, end);
                                tile.classList.toggle("calendar-day--selected", isSelected);
                                tile.classList.toggle("primary-border", isSelected);
                                tile.classList.toggle("faded-background-primary", isSelected);
                                tile.classList.toggle("text-primary", isSelected);
                            });
                        };
                        let isSelectingRange = false;
                        let rangeAnchorDate = null;
                        const startRangeSelection = event => {
                            if (event.button !== 0) return;
                            const tile = event.target?.closest?.("[data]");
                            const dateKey = tile?.getAttribute?.("data") || "";
                            const anchorDate = toDateObject(dateKey);
                            if (!anchorDate) return;
                            clearCreateEventDateTimeRange();
                            isSelectingRange = true;
                            rangeAnchorDate = anchorDate;
                            selectedDate = anchorDate;
                            selectedDateRangeStart = anchorDate;
                            selectedDateRangeEnd = anchorDate;
                            applyRangeSelectionToGrid();
                        };
                        const updateRangeSelection = event => {
                            if (!isSelectingRange || !rangeAnchorDate) return;
                            const tile = event.target?.closest?.("[data]");
                            const dateKey = tile?.getAttribute?.("data") || "";
                            const rangeDate = toDateObject(dateKey);
                            if (!rangeDate) return;
                            selectedDate = rangeAnchorDate;
                            selectedDateRangeStart = rangeAnchorDate;
                            selectedDateRangeEnd = rangeDate;
                            applyRangeSelectionToGrid();
                        };
                        const stopRangeSelection = () => {
                            isSelectingRange = false;
                            rangeAnchorDate = null;
                        };
                        calendarGrid.addEventListener("mousedown", startRangeSelection);
                        calendarGrid.addEventListener("mousemove", updateRangeSelection);
                        document.addEventListener("mouseup", stopRangeSelection);
                        disposeRangeSelectionListeners = () => {
                            calendarGrid.removeEventListener("mousedown", startRangeSelection);
                            calendarGrid.removeEventListener("mousemove", updateRangeSelection);
                            document.removeEventListener("mouseup", stopRangeSelection);
                        };
                        applyRangeSelectionToGrid();
                        calendarGrid.contextmenu(options, "[data]")
                        calendarGrid.popoutmenu(options, "[data]")
                        scrollTileIntoViewWhenReady(calendarGrid, ".calendar-day--selected, .calendar-day--today");
                    }
                },{
                    text: "Week",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 48 48"><path d="M 12.5 6 C 8.9280619 6 6 8.9280619 6 12.5 L 6 35.5 C 6 39.071938 8.9280619 42 12.5 42 L 35.5 42 C 39.071938 42 42 39.071938 42 35.5 L 42 12.5 C 42 8.9280619 39.071938 6 35.5 6 L 12.5 6 z M 12.5 9 L 35.5 9 C 37.450062 9 39 10.549938 39 12.5 L 39 14 L 9 14 L 9 12.5 C 9 10.549938 10.549938 9 12.5 9 z M 9 17 L 14 17 L 14 39 L 12.5 39 C 10.549938 39 9 37.450062 9 35.5 L 9 17 z M 17 17 L 22.5 17 L 22.5 39 L 17 39 L 17 17 z M 25.5 17 L 31 17 L 31 39 L 25.5 39 L 25.5 17 z M 34 17 L 39 17 L 39 35.5 C 39 37.450062 37.450062 39 35.5 39 L 34 39 L 34 17 z"/></svg>`,
                    route: () => {
                        setCalendarPortalTitle(0, getWeekRouteTitle(selectedDate));
                        return div({style: "no-scrollbars large-padding-top", content: () => CLI.send("[events]").then(eventsResponse => {
                                const weekDates = getWeekDates(selectedDate);
                                const eventEntries = getCalendarEventEntries(eventsResponse);
                                return children([
                                    buildCalendarRangeControls({
                                        previous: () => {
                                            selectCalendarDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 7));
                                            refreshMainCalendarPortal();
                                        },
                                        next: () => {
                                            selectCalendarDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 7));
                                            refreshMainCalendarPortal();
                                        },
                                        label: getWeekRouteTitle(selectedDate)
                                    }),
                                    div({
                                        id: "calendar-week-grid",
                                        style: "grid7 small-padding-top",
                                        content: children(weekDates.map(weekDate => {
                                            const isToday = isSameLocalDay(weekDate, new Date());
                                            const dayEntries = getEventEntriesForDate(eventEntries, weekDate);
                                            return div({
                                                data: toLocalDateKey(weekDate),
                                                style: `secondary-tile bordered radius small-padding pointer ${isToday ? "primary-border faded-background-primary" : ""}`,
                                                onclick: event => {
                                                    if (event.target?.closest?.(".calendar-week-event")) return;
                                                    selectCalendarDate(weekDate);
                                                    openCreateEventPortal();
                                                },
                                                content: children([
                                                    div({style: "line", content: children([
                                                            div({style: `strong ${isToday ? "text-primary" : ""}`, content: weekDate.toLocaleDateString([], {weekday: "short"})}),
                                                            div({style: "float-right faded", content: weekDate.toLocaleDateString([], {month: "short", day: "numeric"})})
                                                        ])
                                                    }),
                                                    div({style: "spaced"}),
                                                    div({style: "notes-list",
                                                        content: dayEntries.length === 0 ? div({style: "faded padded center", content: "No events"}) : children(dayEntries.map(eventEntry => div({
                                                                style: "calendar-week-event small-padding-bottom",
                                                                content: renderCalendarEventChip(eventEntry, weekDate, {compact: true})
                                                            })))
                                                    })
                                                ])
                                            });
                                        }))
                                    })
                                ]);
                            })
                        });
                    },
                    afterRender: () => {
                        const weekGrid = document.getElementById("calendar-week-grid");
                        if (!weekGrid) return;
                        const options = [
                            {
                                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M17 11C14.2386 11 12 13.2386 12 16C12 18.7614 14.2386 21 17 21C19.7614 21 22 18.7614 22 16C22 13.2386 19.7614 11 17 11ZM17 11V9M2 9V15.8C2 16.9201 2 17.4802 2.21799 17.908C2.40973 18.2843 2.71569 18.5903 3.09202 18.782C3.51984 19 4.0799 19 5.2 19H13M2 9V8.2C2 7.0799 2 6.51984 2.21799 6.09202C2.40973 5.71569 2.71569 5.40973 3.09202 5.21799C3.51984 5 4.0799 5 5.2 5H13.8C14.9201 5 15.4802 5 15.908 5.21799C16.2843 5.40973 16.5903 5.71569 16.782 6.09202C17 6.51984 17 7.0799 17 8.2V9M2 9H17M5 3V5M14 3V5M15 16H17M17 16H19M17 16V14M17 16V18" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
                                label: "Add Event",
                                action: (_, __, target) => {
                                    updateSelectedDateFromTarget(target);
                                    openCreateEventPortal();
                                }
                            }, {
                                icon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 17V9M16 13.0011L8 13M7 3V5M17 3V5M6.2 21H17.8C18.9201 21 19.4802 21 19.908 20.782C20.2843 20.5903 20.5903 20.2843 20.782 19.908C21 19.4802 21 18.9201 21 17.8V8.2C21 7.07989 21 6.51984 20.782 6.09202C20.5903 5.71569 20.2843 5.40973 19.908 5.21799C19.4802 5 18.9201 5 17.8 5H6.2C5.0799 5 4.51984 5 4.09202 5.21799C3.71569 5.40973 3.40973 5.71569 3.21799 6.09202C3 6.51984 3 7.07989 3 8.2V17.8C3 18.9201 3 19.4802 3.21799 19.908C3.40973 20.2843 3.71569 20.5903 4.09202 20.782C4.51984 21 5.07989 21 6.2 21Z" stroke="black" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
                                label: "Categories",
                                action: () => modular.show("com.standard.calendar", 1)
                            }
                        ];
                        weekGrid.contextmenu(options, "[data]");
                        weekGrid.popoutmenu(options, "[data]");
                    }
                },{
                    text: "Day",
                    icon: `<svg xmlns="http://www.w3.org/2000/svg"  viewBox="0 0 48 48"><path d="M 12.5 6 C 8.9280619 6 6 8.9280619 6 12.5 L 6 35.5 C 6 39.071938 8.9280619 42 12.5 42 L 35.5 42 C 39.071938 42 42 39.071938 42 35.5 L 42 12.5 C 42 8.9280619 39.071938 6 35.5 6 L 12.5 6 z M 12.5 9 L 14 9 L 14 15 L 9 15 L 9 12.5 C 9 10.549938 10.549938 9 12.5 9 z M 17 9 L 35.5 9 C 37.450062 9 39 10.549938 39 12.5 L 39 15 L 17 15 L 17 9 z M 9 18 L 14 18 L 14 23 L 9 23 L 9 18 z M 17 18 L 39 18 L 39 23 L 17 23 L 17 18 z M 9 26 L 14 26 L 14 31 L 9 31 L 9 26 z M 17 26 L 39 26 L 39 31 L 17 31 L 17 26 z M 9 34 L 14 34 L 14 39 L 12.5 39 C 10.549938 39 9 37.450062 9 35.5 L 9 34 z M 17 34 L 39 34 L 39 35.5 C 39 37.450062 37.450062 39 35.5 39 L 17 39 L 17 34 z"/></svg>`,
                    route: () => {
                        setCalendarPortalTitle(0, getDayRouteTitle(selectedDate));
                        return div({style: "no-scrollbars large-padding-top", content: () => CLI.send("[events]").then(eventsResponse => {
                                const dayEntries = getEventEntriesForDate(getCalendarEventEntries(eventsResponse), selectedDate);
                                const dayKey = toLocalDateKey(selectedDate);
                                const entriesByHour = {};
                                dayEntries.forEach(entry => {
                                    const entryHour = entry.startKey === dayKey ? entry.startDate.getHours() : 0;
                                    if (!entriesByHour[entryHour]) entriesByHour[entryHour] = [];
                                    entriesByHour[entryHour].push(entry);
                                });
                                Object.keys(entriesByHour).forEach(hour => entriesByHour[hour].sort(compareEventEntries));
                                return children([
                                    buildCalendarRangeControls({
                                        previous: () => {
                                            selectCalendarDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() - 1));
                                            refreshMainCalendarPortal();
                                        },
                                        next: () => {
                                            selectCalendarDate(new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate() + 1));
                                            refreshMainCalendarPortal();
                                        },
                                        label: getDayRouteTitle(selectedDate)
                                    }),
                                    div({style: "notes-list", content: children(Array.from({length: 24}, (_, hour) => {
                                            const slotDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), hour, 0, 0, 0);
                                            const slotEndDate = new Date(slotDate.getTime() + 60 * 60 * 1000);
                                            const slotEntries = entriesByHour[hour] || [];
                                            return div({style: "bordered-bottom padded small-spaced hover-shadowed pointer", onclick: event => {
                                                    if (event.target?.closest?.(".calendar-day-event")) return;
                                                    openCreateEventPortalForDateTime(slotDate, slotEndDate);
                                                },
                                                content: children([
                                                    div({style: "line", content: children([
                                                            div({style: "strong", content: slotDate.toLocaleTimeString([], {hour: "numeric", minute: "2-digit"})}),
                                                            div({style: "float-right faded tiny-text", content: slotEntries.length === 0 ? "Open" : `${slotEntries.length} event${slotEntries.length === 1 ? "" : "s"}`})
                                                        ])
                                                    }),
                                                    div({style: "small-padding-top", content: slotEntries.length === 0 ? div({style: "faded tiny-text", content: "Create event"}) : children(slotEntries.map(eventEntry => div({style: "calendar-day-event small-padding-bottom", content: renderCalendarEventChip(eventEntry, selectedDate)})))})
                                                ])
                                            });
                                        }))
                                    })
                                ]);
                            })
                        });
                    }
                }
            ]
        }),
        new Portal({
            title: "Categories",
            dimensions: [300, 360],
            navigation: false,
            resizable: false,
            tools: [{
                title: "Create Category",
                icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`,
                onclick: () => modular.show("com.standard.calendar", 2)
            }],
            icon: `<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><style>.s0{fill:none;stroke:#000000;stroke-linecap:round;stroke-linejoin:round;stroke-width: 1 } </style><path class="s0" d="m10 5h-3.29q-0.34 0-0.65 0.13-0.32 0.13-0.56 0.37-0.24 0.24-0.37 0.56-0.13 0.31-0.13 0.65v3.29c0 0.45 0.18 0.89 0.5 1.21l7.3 7.3c0.53 0.53 1.35 0.66 1.98 0.25q0.59-0.39 1.14-0.84 0.55-0.45 1.05-0.95 0.5-0.5 0.95-1.05 0.45-0.55 0.84-1.14c0.41-0.63 0.28-1.45-0.25-1.98l-7.3-7.3q-0.12-0.12-0.26-0.21-0.14-0.09-0.29-0.16-0.16-0.06-0.33-0.1-0.16-0.03-0.33-0.03z"/><path class="s0" d="m7.28 7.28h0.01v0.01h-0.01z"/></svg>`,
            route: () => div({style: "large-padding-top", content: children([
                    div({style: "notes-list", content: div({style: "padded", content: () => CLI.send("[cats]").then(d => {
                                const categories = getCategoriesList(d);
                                if (categories.length === 0) return div({style: "faded padded center", content: "No categories yet"});
                                return children(categories.map(category => {
                                    const categoryName = category?.name || "Untitled";
                                    const categoryColor = category?.color || "transparent";
                                    return div({style: "padded secondary-tile brick line small-spaced hover-shadowed pointer", content: children([
                                            div({style: "inline round small-icon space-right float-left margin-right", content: "", background: categoryColor}),
                                            div({content: children([
                                                    div({style: "float-right faded tiny-text", content: categoryColor}),
                                                    label({style: "inline", content: categoryName}),
                                                ])
                                            }),
                                        ]), onclick: () => {
                                            selectedCategory = category;
                                            modular.show("com.standard.calendar", 3);
                                        }
                                    })
                                }));
                            })
                        })
                    })
                ])
            })
        }),
        new Portal({
            title: "Create Category",
            dimensions: [360, 232],
            navigation: false,
            tools: [{
                title: "Save",
                icon: modular.icons.save,
                onclick: _ => {
                    const name = (document.getElementById("calendar-category-name")?.value || "").trim();
                    const color = (document.getElementById("calendar-category-color")?.value || "").trim();
                    if (name === "" || color === "") {
                        return;
                    }
                    const escapedName = escapeQuotedValue(name);
                    const escapedColor = escapeQuotedValue(color);
                    CLI.send(`[cats] + ("${escapedName}", "${escapedColor}")`).then(r => {
                        if (r !== 0) {
                            refreshCalendarPortals(1);
                            hideCalendarPortal(2);
                        }
                    });
                }
            }],
            resizable: false,
            icon: `<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><style>.s0{fill:none;stroke:#000000;stroke-linecap:round;stroke-linejoin:round;stroke-width: 1 } </style><path class="s0" d="m10 5h-3.29q-0.34 0-0.65 0.13-0.32 0.13-0.56 0.37-0.24 0.24-0.37 0.56-0.13 0.31-0.13 0.65v3.29c0 0.45 0.18 0.89 0.5 1.21l7.3 7.3c0.53 0.53 1.35 0.66 1.98 0.25q0.59-0.39 1.14-0.84 0.55-0.45 1.05-0.95 0.5-0.5 0.95-1.05 0.45-0.55 0.84-1.14c0.41-0.63 0.28-1.45-0.25-1.98l-7.3-7.3q-0.12-0.12-0.26-0.21-0.14-0.09-0.29-0.16-0.16-0.06-0.33-0.1-0.16-0.03-0.33-0.03z"/><path class="s0" d="m7.28 7.28h0.01v0.01h-0.01z"/></svg>`,
            route: () => div({style: "large-padding-top", content: children([
                    div({content: children([
                            div({style: "small-padding bold", content: "Name"}),
                            div({style: "padded", content: input({id: "calendar-category-name", style: "undecorated no-padding", placeholder: "Work"})})
                        ])
                    }),
                    div({content: children([
                            div({style: "small-padding bold", content: "Color"}),
                            input({type: "hidden", id: "calendar-category-color", value: "#7B61FF"}),
                            div({style: "padding-left padding-right", content: children([
                                    colorPicker({id: "calendar-category-color-picker", colors: modular.colors}),
                                    div({style: "small-padding margin-top", content: children([
                                            div({style: "inline round small-icon space-right", id: "calendar-category-color-preview", background: "#7B61FF"}),
                                            label({style: "inline tiny-text faded align-top very-small-padding-top", id: "calendar-category-color-value", content: "#7B61FF"})
                                        ])
                                    })
                                ])
                            })
                        ])
                    })
                ])
            }),
            afterRender: () => {
                const selectedColorInput = document.getElementById("calendar-category-color");
                const selectedColorLabel = document.getElementById("calendar-category-color-value");
                const selectedColorPreview = document.getElementById("calendar-category-color-preview");
                if (!selectedColorInput) return;
                const applySelectedColor = color => {
                    const nextColor = `${color || ""}`.trim();
                    if (nextColor === "") return;
                    selectedColorInput.value = nextColor;
                    if (selectedColorLabel) selectedColorLabel.textContent = nextColor;
                    if (selectedColorPreview) selectedColorPreview.style.backgroundColor = nextColor;
                };
                document.querySelectorAll("#calendar-category-color-picker .color-option").forEach(colorOption => {
                    colorOption.addEventListener("click", () => {
                        const selectedColor = colorOption.getAttribute("primary") || window.getComputedStyle(colorOption).getPropertyValue("background-color");
                        applySelectedColor(selectedColor);
                    });
                });
            }
        }),
        new Portal({
            title: "Edit Category",
            dimensions: [360, 272],
            resizable: false,
            navigation: false,
            tools: [{
                title: "Delete",
                icon: modular.icons.delete,
                onclick: () => deleteSelectedCategory(3)
            },{
                title: "Save",
                icon: modular.icons.save,
                onclick: () => saveSelectedCategory(3)
            }],
            icon: `<svg version="1.2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24"><style>.s0{fill:none;stroke:#000000;stroke-linecap:round;stroke-linejoin:round;stroke-width: 1 } </style><path class="s0" d="m10 5h-3.29q-0.34 0-0.65 0.13-0.32 0.13-0.56 0.37-0.24 0.24-0.37 0.56-0.13 0.31-0.13 0.65v3.29c0 0.45 0.18 0.89 0.5 1.21l7.3 7.3c0.53 0.53 1.35 0.66 1.98 0.25q0.59-0.39 1.14-0.84 0.55-0.45 1.05-0.95 0.5-0.5 0.95-1.05 0.45-0.55 0.84-1.14c0.41-0.63 0.28-1.45-0.25-1.98l-7.3-7.3q-0.12-0.12-0.26-0.21-0.14-0.09-0.29-0.16-0.16-0.06-0.33-0.1-0.16-0.03-0.33-0.03z"/><path class="s0" d="m7.28 7.28h0.01v0.01h-0.01z"/></svg>`,
            route: () => {
                if (!selectedCategory) return div({style: "faded padded center", content: "Select a category first."});
                setCalendarPortalTitle(3, selectedCategory?.name || "Edit Category");
                return div({style: "large-padding-top", content: children([
                        div({content: children([
                                div({style: "small-padding", content: "Name"}),
                                div({style: "padded", content: input({id: "edit-calendar-category-name", style: "undecorated no-padding", placeholder: "Work", value: selectedCategory?.name || ""})})
                            ])
                        }),
                        div({content: children([
                                div({style: "small-padding", content: "Color"}),
                                input({type: "hidden", id: "edit-calendar-category-color", value: selectedCategory?.color || "#7B61FF"}),
                                div({style: "padding-left padding-right", content: children([
                                        colorPicker({id: "edit-calendar-category-color-picker", colors: modular.colors}),
                                        div({style: "small-padding margin-top", content: children([
                                                div({style: "inline round small-icon space-right", id: "edit-calendar-category-color-preview", background: selectedCategory?.color || "#7B61FF"}),
                                                label({style: "inline tiny-text faded align-top very-small-padding-top", id: "edit-calendar-category-color-value", content: selectedCategory?.color || "#7B61FF"})
                                            ])
                                        })
                                    ])
                                })
                            ])
                        }),
                        div({style: "spaced"})
                    ])
                });
            },
            afterRender: () => {
                if (!selectedCategory) return;
                const selectedColorInput = document.getElementById("edit-calendar-category-color");
                const selectedColorLabel = document.getElementById("edit-calendar-category-color-value");
                const selectedColorPreview = document.getElementById("edit-calendar-category-color-preview");
                if (!selectedColorInput) return;
                const applySelectedColor = color => {
                    const nextColor = `${color || ""}`.trim();
                    if (nextColor === "") return;
                    selectedColorInput.value = nextColor;
                    if (selectedColorLabel) selectedColorLabel.textContent = nextColor;
                    if (selectedColorPreview) selectedColorPreview.style.backgroundColor = nextColor;
                };
                document.querySelectorAll("#edit-calendar-category-color-picker .color-option").forEach(colorOption => {
                    colorOption.addEventListener("click", () => {
                        const selectedColor = colorOption.getAttribute("primary") || window.getComputedStyle(colorOption).getPropertyValue("background-color");
                        applySelectedColor(selectedColor);
                    });
                });
            }
        }),
        new Portal({
            title: getCreateEventPortalTitle(),
            instanceId: "create-event-recurrence-v3",
            dimensions: [380, 305],
            navigation: false,
            tools: [{
                title: "Save",
                icon: modular.icons.save,
                onclick: () => createEventFromPortal(4)
            }],
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5m-9-6h.008v.008H12v-.008ZM12 15h.008v.008H12V15Zm0 2.25h.008v.008H12v-.008ZM9.75 15h.008v.008H9.75V15Zm0 2.25h.008v.008H9.75v-.008ZM7.5 15h.008v.008H7.5V15Zm0 2.25h.008v.008H7.5v-.008Zm6.75-4.5h.008v.008h-.008v-.008Zm0 2.25h.008v.008h-.008V15Zm0 2.25h.008v.008h-.008v-.008Zm2.25-4.5h.008v.008H16.5v-.008Zm0 2.25h.008v.008H16.5V15Z" /></svg>`,
            route: () => div({style: "no-scrollbars large-padding-top", id: "", content: () => CLI.send("[cats]").then(response => {
                    const categories = getCategoriesList(response);
                    Object.keys(eventCategoryLookup).forEach(key => delete eventCategoryLookup[key]);
                        categories.forEach(category => {
                            const categoryId = normalizeRecordId(category?.id);
                            if (categoryId !== "") eventCategoryLookup[categoryId] = category;
                        });
                        const categoryOptions = categories.map(category => ({value: normalizeRecordId(category?.id), name: category?.name || "Untitled"}));
                    return children([
                        input({type: "hidden", id: "event-category-id", value: ""}),
                        div({content: children([
                                div({style: "faded small-padding bold", content: "Category"}),
                                div({style: "padded", content: searchbox({id: "event-category", style: "undecorated no-padding", placeholder: "Select category", options: categoryOptions})})
                            ]),
                        }),
                        div({content: children([
                                div({style: "faded small-padding bold", content: "Event Name"}),
                                div({style: "padded", content: input({id: "event-name", style: "undecorated no-padding", placeholder: ""})})
                            ]),
                        }),
                        div({content: children([
                                div({style: "faded small-padding bold", content: "Start"}),
                                div({style: "padded", content: input({id: "start-timestamp", type: "datetime-local", style: "undecorated no-padding", placeholder: "", value: (() => {
                                            const createRange = getCreateEventDateTimeRange();
                                            const createStart = createRange.start;
                                            return createStart ? toDateTimeLocalValue(createStart, createStart.getHours(), createStart.getMinutes()) : "";
                                        })()})})
                            ]),
                        }),
                        div({content: children([
                                div({style: "faded small-padding bold", content: "End"}),
                                div({style: "padded", content: input({id: "end-timestamp", type: "datetime-local", style: "undecorated no-padding", placeholder: "", value: (() => {
                                            const createRange = getCreateEventDateTimeRange();
                                            const createEnd = createRange.end;
                                            return createEnd ? toDateTimeLocalValue(createEnd, createEnd.getHours(), createEnd.getMinutes()) : "";
                                        })()})})
                            ]),
                        }),
                        buildRecurrenceControls("create", getCreateEventDateTimeRange().start)
                    ]);
                })
            }),
            afterRender: () => {
                setCalendarPortalTitle(4, getCreateEventPortalTitle());
                const initializeCreateEventForm = (attemptsRemaining = 20) => {
                    const categoryInput = document.getElementById("event-category");
                    const categoryIdInput = document.getElementById("event-category-id");
                    const startInput = document.getElementById("start-timestamp");
                    const endInput = document.getElementById("end-timestamp");
                    if (!categoryInput || !categoryIdInput || !startInput || !endInput) {
                        if (attemptsRemaining > 0) setTimeout(() => initializeCreateEventForm(attemptsRemaining - 1), 25);
                        return;
                    }
                    const {start, end} = getCreateEventDateTimeRange();
                    startInput.value = start ? toDateTimeLocalValue(start, start.getHours(), start.getMinutes()) : "";
                    endInput.value = end ? toDateTimeLocalValue(end, end.getHours(), end.getMinutes()) : "";
                    bindRecurrenceControls("create", startInput);
                    const applySelectedCategory = categoryId => {
                        const normalizedCategoryId = normalizeRecordId(categoryId);
                        const selectedCategory = eventCategoryLookup[normalizedCategoryId];
                        if (!selectedCategory) {
                            categoryInput.style.color = "";
                            return;
                        }
                        categoryIdInput.value = normalizedCategoryId;
                        categoryInput.value = selectedCategory.name || "Untitled";
                        categoryInput.style.color = selectedCategory.color || "";
                    };
                    categoryInput.addEventListener("input", () => {
                        categoryIdInput.value = "";
                        categoryInput.style.color = "";
                    });
                    categoryInput.addEventListener("change", () => {
                        const selectedCategoryId = categoryInput.getAttribute("data-searchbox-selected-value") || "";
                        if (selectedCategoryId !== "") applySelectedCategory(selectedCategoryId);
                    });
                    categoryInput.addEventListener("blur", () => {
                        const selectedCategoryId = categoryInput.getAttribute("data-searchbox-selected-value") || "";
                        if (selectedCategoryId !== "") {
                            applySelectedCategory(selectedCategoryId);
                            return;
                        }
                        const currentValue = categoryInput.value.trim().toLowerCase();
                        const matchedCategory = Object.values(eventCategoryLookup).find(category => `${category?.name || ""}`.trim().toLowerCase() === currentValue);
                        if (matchedCategory?.id !== undefined && matchedCategory?.id !== null) applySelectedCategory(`${matchedCategory.id}`);
                    });
                };
                initializeCreateEventForm();
            }
        }),
        new Portal({
            title: "View Event",
            dimensions: [350, 310],
            navigation: false,
            tools: [{
                title: "Edit",
                icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.35" stroke="currentColor"><g transform="scale(0.9) translate(1.333 1.333) translate(0.25 0.6)"><path stroke-linecap="round" stroke-linejoin="round" d="M16.5 3.75a2.121 2.121 0 1 1 3 3L9 17.25 4.5 18.75 6 14.25 16.5 3.75Z" /><path stroke-linecap="round" stroke-linejoin="round" d="M15 5.25l3 3" /></g></svg>`,
                onclick: () => {
                    if (!selectedEvent) return;
                    hideCalendarPortal(5);
                    modular.show("com.standard.calendar", 6)
                }
            },{
                title: "Delete",
                icon: modular.icons.delete,
                onclick: () => deleteSelectedEvent(5)
            }],
            icon: "/icons/interfaces/calendar.png",
            route: () => {
                if (!selectedEvent) return div({style: "faded padded center", content: "Select an event from the calendar."});
                setCalendarPortalTitle(5, selectedEvent?.name || "Untitled");
                const startLabel = toDateTimeLabel(getEventBoundary(selectedEvent, "start")) || "Not set";
                const endLabel = toDateTimeLabel(getEventBoundary(selectedEvent, "end")) || "Not set";
                return div({style: "large-padding-top", content: children([
                        div({content: children([
                                div({style: "faded small-padding bold", content: "Category"}),
                                div({style: "padded", content: selectedEvent?.category?.name || "Uncategorized"})
                            ])
                        }),
                        div({content: children([
                                div({style: "faded small-padding bold", content: "Start"}),
                                div({style: "padded", content: startLabel})
                            ])
                        }),
                        div({content: children([
                                div({style: "faded small-padding bold", content: "End"}),
                                div({style: "padded", content: endLabel})
                            ])
                        }),
                    ])
                });
            }
        }),
        new Portal({
            title: "Edit Event",
            instanceId: "edit-event-recurrence-v3",
            dimensions: [380, 360],
            navigation: false,
            tools: [{
                title: "Delete",
                icon: modular.icons.delete,
                onclick: () => deleteSelectedEvent(6)
            },{
                title: "Save",
                icon: modular.icons.save,
                onclick: () => saveSelectedEvent(6)
            }],
            icon: "/icons/interfaces/calendar.png",
            route: () => div({style: "no-scrollbars large-padding-top", content: () => {
                    if (!selectedEvent) return div({style: "faded padded center", content: "Select an event from the calendar first."});
                    return CLI.send("[cats]").then(response => {
                        const categories = getCategoriesList(response);
                        Object.keys(eventCategoryLookup).forEach(key => delete eventCategoryLookup[key]);
                        categories.forEach(category => {
                            const categoryId = normalizeRecordId(category?.id);
                            if (categoryId !== "") eventCategoryLookup[categoryId] = category;
                        });
                        const categoryOptions = categories.map(category => ({value: normalizeRecordId(category?.id), name: category?.name || "Untitled"}));
                        const selectedCategoryId = getSelectedEventCategoryId(selectedEvent);
                        const startDate = toDateObject(getEventBoundary(selectedEvent, "start"));
                        const endDate = toDateObject(getEventBoundary(selectedEvent, "end"));
                        const selectedCategory = eventCategoryLookup[selectedCategoryId] || selectedEvent?.category || null;
                        return children([
                            input({type: "hidden", id: "edit-event-category-id", value: selectedCategoryId}),
                            div({content: children([
                                    div({style: "small-padding", content: "Category"}),
                                    div({style: "padded", content: searchbox({
                                            id: "edit-event-category",
                                            style: "undecorated no-padding",
                                            placeholder: "Select category",
                                            options: categoryOptions,
                                            value: selectedCategory?.name || ""
                                        })
                                    })
                                ])
                            }),
                            div({content: children([
                                    div({style: "small-padding", content: "Event Name"}),
                                    div({style: "padded", content: input({id: "edit-event-name", style: "undecorated no-padding", placeholder: "", value: selectedEvent?.name || ""})})
                                ])
                            }),
                            div({content: children([
                                    div({style: "small-padding", content: "Start"}),
                                    div({style: "padded", content: input({
                                            id: "edit-start-timestamp",
                                            type: "datetime-local",
                                            style: "undecorated no-padding",
                                            placeholder: "",
                                            value: startDate ? toDateTimeLocalValue(startDate, startDate.getHours(), startDate.getMinutes()) : ""
                                        })
                                    })
                                ])
                            }),
                            div({content: children([
                                    div({style: "small-padding", content: "End"}),
                                    div({style: "padded", content: input({
                                            id: "edit-end-timestamp",
                                            type: "datetime-local",
                                            style: "undecorated no-padding",
                                            placeholder: "",
                                            value: endDate ? toDateTimeLocalValue(endDate, endDate.getHours(), endDate.getMinutes()) : ""
                                        })
                                    })
                                ])
                            }),
                            buildRecurrenceControls("edit", startDate || new Date()),
                            div({style: "spaced"})
                        ]);
                    });
                }
            }),
            afterRender: () => {
                if (!selectedEvent) return;
                const categoryInput = document.getElementById("edit-event-category");
                const categoryIdInput = document.getElementById("edit-event-category-id");
                const startInput = document.getElementById("edit-start-timestamp");
                const endInput = document.getElementById("edit-end-timestamp");
                const nameInput = document.getElementById("edit-event-name");
                const selectedCategoryId = getSelectedEventCategoryId(selectedEvent);
                if (nameInput) nameInput.value = selectedEvent?.name || "";
                if (startInput) {
                    const startDate = toDateObject(getEventBoundary(selectedEvent, "start"));
                    startInput.value = startDate ? toDateTimeLocalValue(startDate, startDate.getHours(), startDate.getMinutes()) : "";
                }
                if (endInput) {
                    const endDate = toDateObject(getEventBoundary(selectedEvent, "end"));
                    endInput.value = endDate ? toDateTimeLocalValue(endDate, endDate.getHours(), endDate.getMinutes()) : "";
                }
                bindRecurrenceControls("edit", startInput);
                if (!categoryInput || !categoryIdInput) return;
                const applySelectedCategory = categoryId => {
                    const normalizedCategoryId = normalizeRecordId(categoryId);
                    const selectedCategory = eventCategoryLookup[normalizedCategoryId];
                    if (!selectedCategory) {
                        categoryInput.style.color = "";
                        return;
                    }
                    categoryIdInput.value = normalizedCategoryId;
                    categoryInput.value = selectedCategory.name || "Untitled";
                    categoryInput.style.color = selectedCategory.color || "";
                    categoryInput.setAttribute("data-searchbox-selected-value", normalizedCategoryId);
                };
                if (selectedCategoryId !== "") applySelectedCategory(selectedCategoryId);
                categoryInput.addEventListener("input", () => {
                    categoryIdInput.value = "";
                    categoryInput.style.color = "";
                });
                categoryInput.addEventListener("change", () => {
                    const nextCategoryId = categoryInput.getAttribute("data-searchbox-selected-value") || "";
                    if (nextCategoryId !== "") applySelectedCategory(nextCategoryId);
                });
                categoryInput.addEventListener("blur", () => {
                    const nextCategoryId = categoryInput.getAttribute("data-searchbox-selected-value") || "";
                    if (nextCategoryId !== "") {
                        applySelectedCategory(nextCategoryId);
                        return;
                    }
                    const currentValue = categoryInput.value.trim().toLowerCase();
                    const matchedCategory = Object.values(eventCategoryLookup).find(category => `${category?.name || ""}`.trim().toLowerCase() === currentValue);
                    if (matchedCategory?.id !== undefined && matchedCategory?.id !== null) applySelectedCategory(`${matchedCategory.id}`);
                });
            }
        })
    ]))
})();