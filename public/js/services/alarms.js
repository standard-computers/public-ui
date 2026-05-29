(async () => {
    const ALARMS_SERVICE_ID = "com.standard.alarms";
    const DEFAULT_ALARM_NAME = "Untitled";
    const ALARM_SETTINGS = {default_name: {label: "Default Name", type: "text", default: DEFAULT_ALARM_NAME}};
    const FILES_EDIT_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" /></svg>`;
    const FILES_DELETE_ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" /></svg>`;
    const padTimeUnit = value => `${Number.isFinite(value) ? value : 0}`.padStart(2, "0");
    const escapeCliQuotedValue = (value = "") => String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    const to12HourTimestamp = (h, m) => {
        const safeHour = Number.isFinite(h) ? h : 0;
        const safeMinute = Number.isFinite(m) ? m : 0;
        const normalizedHour = ((safeHour % 24) + 24) % 24;
        const normalizedMinute = ((safeMinute % 60) + 60) % 60;
        const period = normalizedHour >= 12 ? "PM" : "AM";
        const hour12 = normalizedHour % 12 === 0 ? 12 : normalizedHour % 12;
        return `${hour12}:${normalizedMinute.toString().padStart(2, "0")} ${period}`;
    };
    const parseTimestamp = timestamp => {
        const match = `${timestamp || ""}`.trim().match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
        if (!match) return {hour: 7, minute: 0};
        const hour12 = parseInt(match[1], 10);
        const minute = parseInt(match[2], 10);
        const meridiem = match[3].toUpperCase();
        let hour = hour12 % 12;
        if (meridiem === "PM") hour += 12;
        return {hour, minute};
    };
    const getAlarmSortKey = alarm => {
        const parsed = parseTimestamp(alarm && alarm.timestamp);
        return parsed.hour * 60 + parsed.minute;
    };
    const NUMBER_WORDS = {zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50};
    const parseNumberWords = str => {
        const words = str.split(/\s+/);
        let nums = [];
        for (let w of words) if (NUMBER_WORDS[w] !== undefined) nums.push(NUMBER_WORDS[w]);
        if (nums.length === 1) return {value: nums[0], extra: null};
        if (nums.length === 2 && nums[1] < 10) return {value: nums[0], extra: nums[1]};
        return null;
    };
    const parseFuzzyTime = input => {
        input = input.toLowerCase().replace(/[^a-z0-9\s:]/g, "");
        let hour = null;
        let minute = 0;
        let ampm = null;
        if (input.includes("noon")) return {hour: 12, minute: 0};
        if (input.includes("midnight")) return {hour: 0, minute: 0};
        if (/\b(a\.?m?\.?)\b/.test(input)) ampm = "am";
        if (/\b(p\.?m?\.?)\b/.test(input)) ampm = "pm";
        if (input.includes("morning")) ampm = "am";
        if (input.includes("afternoon")) ampm = "pm";
        if (input.includes("evening")) ampm = "pm";
        if (input.includes("tonight")) ampm = "pm";
        if (input.includes("quarter past")) minute = 15;
        if (input.includes("half past")) minute = 30;
        if (input.includes("quarter to")) minute = 45;
        if (input.includes("ten to")) minute = 50;
        if (input.includes("five to")) minute = 55;
        if (input.includes("ten past")) minute = 10;
        if (input.includes("five past")) minute = 5;
        let numParsed = parseNumberWords(input);
        if (numParsed) {
            hour = numParsed.value;
            if (numParsed.extra !== null) minute = numParsed.extra * 10;
        }
        let match = input.match(/(\d{1,2})(?::(\d{2}))?/);
        if (match) {
            hour = parseInt(match[1]);
            if (match[2]) minute = parseInt(match[2]);
        }
        if (hour === null) {
            for (let w in NUMBER_WORDS) {
                if (input.includes(w)) {
                    let val = NUMBER_WORDS[w];
                    if (val <= 12) hour = val;
                }
            }
        }
        if (ampm === "pm" && hour < 12) hour += 12;
        if (ampm === "am" && hour === 12) hour = 0;
        if (hour === null) return null;
        return {hour, minute};
    };
    const getDefaultAlarmName = async (view = null) => {
        try {
            const values = typeof view?.settings?.values === "function" ? await view.settings.values() : await window.StandardAppSettings?.values?.(ALARMS_SERVICE_ID);
            const defaultName = String(values?.default_name || DEFAULT_ALARM_NAME).trim();
            return defaultName || DEFAULT_ALARM_NAME;
        } catch (_) {
            return DEFAULT_ALARM_NAME;
        }
    };
    const findAlarmById = async alarmId => {
        const safeAlarmId = `${alarmId ?? ""}`.trim();
        if (!safeAlarmId) return null;
        const response = await CLI.send("[alarms]");
        const alarms = Array.isArray(response?.alarms) ? response.alarms : [];
        return alarms.find(alarm => `${alarm?.id ?? ""}` === safeAlarmId) || null;
    };
    const openAlarmPortal = alarm => {
        const parsedTime = parseTimestamp(alarm.timestamp);
        const handleAlarmMutation = (promise, successMessage, errorMessage) => {
            promise.then(d => {
                if (d !== 0) {
                    alarmPortal.close();
                    modular.success(successMessage);
                    modular.refresh("com.standard.alarms");
                } else {
                    modular.error(errorMessage);
                }
            });
        };
        const saveAlarm = () => {
            const nextHour = parseInt(document.getElementById("alarm-edit-hour").value, 10);
            const nextMinute = parseInt(document.getElementById("alarm-edit-minute").value, 10);
            const nextTimestamp = to12HourTimestamp(nextHour, nextMinute);
            handleAlarmMutation(CLI.send(`[alarms] timestamp "${nextTimestamp}" <id ${alarm.id}>`), "Updated alarm", "Couldn't update alarm");
        };
        const alarmPortal = new Portal({title: alarm.name || "Alarm", dimensions: [340, 146], resizable: false, navigation: false, tools: [,{
                title: "Save",
                icon: modular.icons.save,
                onclick: saveAlarm
            },{
                title: "Delete",
                icon: modular.icons.delete,
                onclick: () => handleAlarmMutation(CLI.send(`[alarms] - <id ${alarm.id}>`), "Deleted alarm", "Couldn't delete alarm")
            }],
            icon: "/icons/interfaces/alarms.png", route: () => div({style: "large-padding-top no-scrollbars", content: children([
                        div({style: "list padded", content: children([
                            em({style: "faded", content: `Currently set for ${alarm.timestamp}`}),
                            div({style: "spacer"}),
                            div({style: "bi", content: children([
                                div({content: children([
                                    label({style: "faded", content: "Hour"}),
                                    input({id: "alarm-edit-hour", type: "number", min: 0, max: 23, value: parsedTime.hour})
                                ])
                            }),
                            div({content: children([label({style: "faded", content: "Minute"}), input({id: "alarm-edit-minute", type: "text", inputmode: "numeric", pattern: "[0-9]*", maxlength: 2, value: padTimeUnit(parsedTime.minute)})])})])
                        })
                    ])
                })])
            })
        });
        alarmPortal.show();
    };
    const getAlarmTileId = tile => `${tile?.getAttribute?.("data") || ""}`.trim();
    const openAlarmTileEditor = async tile => {
        const alarmId = getAlarmTileId(tile);
        const alarm = await findAlarmById(alarmId);
        if (alarm) {
            openAlarmPortal(alarm);
        } else {
            modular.error("Couldn't find alarm");
        }
    };
    const deleteAlarmTile = tile => {
        const alarmId = getAlarmTileId(tile);
        if (!alarmId) return;
        CLI.send(`[alarms] - <id ${alarmId}>`).then(response => {
            if (response !== 0) {
                tile?.remove?.();
                modular.success("Deleted alarm");
            } else {
                modular.error("Couldn't delete alarm");
            }
        }).catch(() => {
            modular.error("Couldn't delete alarm");
        });
    };
    const bindAlarmListContextMenu = () => {
        const alarmsList = document.getElementById("alarms-list");
        if (!alarmsList || alarmsList.dataset.contextMenuBound === "1") return;
        alarmsList.dataset.contextMenuBound = "1";
        alarmsList.contextmenu([{
            icon: FILES_EDIT_ICON,
            label: "Edit",
            visible: (_root, target) => !!target?.closest?.(".alarm-tile"),
            action: (_root, _event, tile) => openAlarmTileEditor(tile)
        }, {
            icon: FILES_DELETE_ICON,
            label: "Delete",
            destructive: true,
            visible: (_root, target) => !!target?.closest?.(".alarm-tile"),
            action: (_root, _event, tile) => deleteAlarmTile(tile)
        }], ".alarm-tile");
    };
    window.StandardAlarms = window.StandardAlarms || {};
    window.StandardAlarms.openAlarm = alarm => openAlarmPortal(alarm);
    window.StandardAlarms.findAlarmById = findAlarmById;
    window.StandardAlarms.notifyAlarm = async ({data = []} = {}) => {
        const alarmId = `${data?.[0] ?? ""}`.trim();
        let alarm = null;
        try {
            alarm = await window.StandardAlarms.findAlarmById(alarmId);
        } catch (error) {
            console.error("Failed to load alarm notification", error);
        }
        const alarmName = `${alarm?.name || ""}`.trim() || DEFAULT_ALARM_NAME;
        const alarmTime = `${alarm?.timestamp || ""}`.trim();
        const fallbackLabel = alarmId ? `Alarm ${alarmId}` : "Alarm";
        window.StandardNotifications?.show?.({
            type: "alarms",
            title: alarm ? alarmName : fallbackLabel,
            message: alarmTime ? `Alarm set for ${alarmTime}` : "Alarm triggered",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`
        });
        modular.refresh(ALARMS_SERVICE_ID);
    };
    window.StandardNotifications?.register?.("alarms", window.StandardAlarms.notifyAlarm);
    modular.register(new Service(ALARMS_SERVICE_ID, [new Portal({
        title: "Alarms",
        hints: ["alarms"],
        dimensions: [380, 500],
        navigation: false,
        resizable: false,
        tools: [{
            title: "New Alarm",
            icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>`,
            onclick: async (_event, view) => {
                const defaultAlarmName = await getDefaultAlarmName(view);
                inputDialogue({title: "What Time?", titleholder: defaultAlarmName, title_entry: true, placeholder: "9 AM, 10 tonight, etc.", confirmation: (title, t) => {
                        const tdsv = parseFuzzyTime(t);
                        const thrs = (tdsv.hour > 12 ? tdsv.hour - 12 : tdsv.hour);
                        const ttod = (tdsv.hour >= 12 ? "PM " : "AM");
                        const tdsm = (tdsv.minute <= 9 ? `0${tdsv.minute}` : tdsv.minute);
                        const tds = `${thrs}:${tdsm} ${ttod}`;
                        const userId = modular.user.id();
                        const alarmName = String(title || "").trim() === "" ? defaultAlarmName : title;
                        CLI.send(`[alarms] + (@${userId}, "${escapeCliQuotedValue(alarmName)}", "${tds}", 1, true, true, [0,1,2,3,4,5,6])`, false).then(d => {
                            if (d !== 0) {
                                modular.refresh(ALARMS_SERVICE_ID, 0);
                                modular.success("Created alarm");
                            } else {
                                modular.error("Couldn't create alarm");
                            }
                        })
                    }
                })
            }
        }],
        svg_icon: `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>`,
        icon: "/icons/interfaces/alarms.png",
        route: () => div({style: "large-padding-top", content: children([
                div({id: "alarms-list", style: "list", content: () => {
                    return CLI.send("[alarms]").then(d => {
                        const sortedAlarms = [...d.alarms].sort((a, b) => getAlarmSortKey(a) - getAlarmSortKey(b));
                        let as = [];
                        for (let i = 0; i < sortedAlarms.length; i++) {
                            const alarm = sortedAlarms[i];
                            as.push(div({style: "alarm-tile padded secondary-tile brick line", data: alarm.id, onclick: () => openAlarmPortal(alarm), content: children([
                                    div({onclick: event => event.stopPropagation(), content: switcher({style: "no-margin float-right large-adjust-top",
                                            id: `alarm-enabled-${alarm.id}`, checked: alarm.enabled, onchange: event => {
                                                event.stopPropagation();
                                                const isActive = event.target.checked;
                                                CLI.send(`[alarms] enabled ${isActive} <id ${alarm.id}>`).then(r => {
                                                    if (r !== 0) {
                                                        modular.success((isActive ? "Enabled" : "Disabled") + " " + (alarm.name || "Untitled"));
                                                        modular.refresh("com.standard.alarms");
                                                    } else {
                                                        modular.error("Couldn't update alarm");
                                                    }
                                                });
                                            }
                                        })
                                    }),
                                    h({level: 3, content: alarm.name}),
                                    em({content: alarm.timestamp})
                                ])
                            }))
                        }
                        return children(as);
                    })
                }
            })])
        }),
        afterRender: bindAlarmListContextMenu
    })], ALARM_SETTINGS));
})();