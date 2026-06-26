# Hardcoded Color Violations

List of hardcoded colors found in the codebase without clear justification (excluding SVG raw graphics, themes, etc.).


## [manifest.ts](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/app/manifest.ts)

- **Line 10**: `background_color: "#071624", // Updated to match your dark mode theme (Midnight Blue)`
  - Detected: Hex: `#071624`
- **Line 11**: `theme_color: "#67C8DD", // Your Primary Turquoise`
  - Detected: Hex: `#67C8DD`

## [layout.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/app/(themed)/(post-auth)/(with-hive)/layout.tsx)

- **Line 58**: `"linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",`
  - Detected: Hex: `#f59e0b`, Hex: `#d97706`
- **Line 59**: `color: "white",`
  - Detected: Named: `color: "white"`
- **Line 60**: `boxShadow: "0px 6px 20px rgba(217, 119, 6, 0.4)",`
  - Detected: rgba/hsl: `rgba(217, 119, 6, 0.4)`
- **Line 64**: `"linear-gradient(135deg, #d97706 0%, #b45309 100%)",`
  - Detected: Hex: `#d97706`, Hex: `#b45309`
- **Line 66**: `"0px 8px 24px rgba(217, 119, 6, 0.6)",`
  - Detected: rgba/hsl: `rgba(217, 119, 6, 0.6)`

## [page.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/app/(themed)/(pre-auth)/login/page.tsx)

- **Line 53**: `borderColor: "rgba(0,0,0,0.08)",`
  - Detected: rgba/hsl: `rgba(0,0,0,0.08)`
- **Line 54**: `boxShadow: "0 24px 50px rgba(0,0,0,0.15)",`
  - Detected: rgba/hsl: `rgba(0,0,0,0.15)`
- **Line 56**: `borderColor: "rgba(255,255,255,0.08)",`
  - Detected: rgba/hsl: `rgba(255,255,255,0.08)`

## [index.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/curriculum-fab/index.tsx)

- **Line 160**: `boxShadow: "0 10px 20px rgba(0, 0, 0, 0.2)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.2)`
- **Line 184**: `"0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",`
  - Detected: rgba/hsl: `rgba(0,0,0,0.1)`, rgba/hsl: `rgba(0,0,0,0.1)`

## [HoursCard.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/curriculum-view/components/HoursCard.tsx)

- **Line 104**: `fill: "grey.200",`
  - Detected: Named: `fill: "grey.200"`

## [utils.ts](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/curriculum-view/tabs/builder-tab/components/utils.ts)

- **Line 14**: `return `hsla(${hue}, 65%, 55%, ${opacity})`;`
  - Detected: rgba/hsl: `hsla(${hue}, 65%, 55%, ${opacity})`

## [SyllabusSection.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/curriculum-view/tabs/builder-tab/components/syllabus-modules/SyllabusSection.tsx)

- **Line 74**: `backgroundColor: "rgba(0, 0, 0, 0.1)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.1)`
- **Line 78**: `backgroundColor: "rgba(0, 0, 0, 0.2)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.2)`

## [GanttBlock.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/GanttBlock.tsx)

- **Line 83**: `? "0 10px 25px rgba(0, 0, 0, 0.2)"`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.2)`

## [DayCapacityCell.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/curriculum-view/tabs/weeks-tab/DayCapacityCell.tsx)

- **Line 548**: `"1px solid rgba(0, 0, 0, 0.42) !important",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.42)`

## [index.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/curriculum-view/tabs/weeks-tab/index.tsx)

- **Line 259**: `boxShadow: "0 8px 32px rgba(0, 0, 0, 0.04)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.04)`

## [WeeksCapacityGrid.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/curriculum-view/tabs/weeks-tab/WeeksCapacityGrid.tsx)

- **Line 443**: `boxShadow: "0 4px 24px rgba(0, 0, 0, 0.03)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.03)`

## [WeeksSummaryBar.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/curriculum-view/tabs/weeks-tab/WeeksSummaryBar.tsx)

- **Line 112**: `boxShadow: "0 2px 12px rgba(0, 0, 0, 0.02)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.02)`
- **Line 141**: `bgcolor: "rgba(103, 200, 221, 0.04)",`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.04)`
- **Line 149**: `boxShadow: "0 4px 12px rgba(103, 200, 221, 0.08)",`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.08)`
- **Line 152**: `bgcolor: "rgba(12, 34, 55, 0.2)",`
  - Detected: rgba/hsl: `rgba(12, 34, 55, 0.2)`

## [index.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/syllabus-card/index.tsx)

- **Line 68**: `"0 12px 24px -10px rgba(0, 0, 0, 0.15), 0 8px 16px -8px rgba(0, 0, 0, 0.1)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.15)`, rgba/hsl: `rgba(0, 0, 0, 0.1)`

## [ModulesTable.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/gantt/syllabus-card/ModulesTable.tsx)

- **Line 93**: `backgroundColor: "rgba(0, 0, 0, 0.1)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.1)`
- **Line 97**: `backgroundColor: "rgba(0, 0, 0, 0.2)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.2)`

## [FilterIcon.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/header/FilterIcon.tsx)

- **Line 75**: `boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",`
  - Detected: rgba/hsl: `rgba(0,0,0,0.1)`, rgba/hsl: `rgba(0,0,0,0.1)`

## [ThemeSelector.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/header/ThemeSelector.tsx)

- **Line 8**: `stroke="#b45309"`
  - Detected: Hex: `#b45309`
- **Line 24**: `stroke="#334155"`
  - Detected: Hex: `#334155`

## [UserAccessCard.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/header/UserAccessCard.tsx)

- **Line 92**: `boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.08)`

## [CalendarToolbar.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/schedule/calendar/calendar/CalendarToolbar.tsx)

- **Line 302**: `"0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1)",`
  - Detected: rgba/hsl: `rgba(0,0,0,0.1)`, rgba/hsl: `rgba(0,0,0,0.1)`

## [base.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/schedule/event-component/base.tsx)

- **Line 31**: `(event.type === EventType.PRAYER ? "#e0f9fe" : subject?.color) ??`
  - Detected: Hex: `#e0f9fe`

## [EventTooltip.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/schedule/event-component/EventTooltip.tsx)

- **Line 101**: `<Divider sx={{ mb: 0.5, borderColor: "rgba(255,255,255,0.2)" }} />`
  - Detected: rgba/hsl: `rgba(255,255,255,0.2)`
- **Line 162**: `sx={{ my: 0.5, borderColor: "rgba(255,255,255,0.2)" }}`
  - Detected: rgba/hsl: `rgba(255,255,255,0.2)`
- **Line 186**: `sx={{ my: 0.5, borderColor: "rgba(255,255,255,0.2)" }}`
  - Detected: rgba/hsl: `rgba(255,255,255,0.2)`

## [InstructorsField.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/schedule/event-dialog/InstructorsField.tsx)

- **Line 126**: `borderBottomColor: "hsl(var(--border))",`
  - Detected: rgba/hsl: `hsl(var(--border)`

## [DiffDetailsTable.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/schedule/offline-dialogs/push-updates-dialog/DiffDetailsTable.tsx)

- **Line 99**: `? "rgba(239, 68, 68, 0.04)"`
  - Detected: rgba/hsl: `rgba(239, 68, 68, 0.04)`
- **Line 103**: `? "rgba(239, 68, 68, 0.08) !important"`
  - Detected: rgba/hsl: `rgba(239, 68, 68, 0.08)`

## [index.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/schedule/subject-dialog/index.tsx)

- **Line 37**: `const [color, setColor] = useState("#1976d2");`
  - Detected: Hex: `#1976d2`
- **Line 44**: `setColor("#1976d2");`
  - Detected: Hex: `#1976d2`

## [types.ts](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/schedule/types/types.ts)

- **Line 5**: `students: "#4caf50",`
  - Detected: Hex: `#4caf50`
- **Line 6**: `instructors: "#2196f3",`
  - Detected: Hex: `#2196f3`
- **Line 7**: `helpers: "#ff9800",`
  - Detected: Hex: `#ff9800`
- **Line 8**: `other: "#9e9e9e",`
  - Detected: Hex: `#9e9e9e`
- **Line 12**: `student: "#81c784",`
  - Detected: Hex: `#81c784`
- **Line 13**: `instructor: "#64b5f6",`
  - Detected: Hex: `#64b5f6`
- **Line 14**: `helper: "#ffb74d",`
  - Detected: Hex: `#ffb74d`
- **Line 15**: `other: "#e0e0e0",`
  - Detected: Hex: `#e0e0e0`

## [SettingsDialog.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/SettingsDialog.tsx)

- **Line 57**: `boxShadow: "0 24px 50px rgba(0,0,0,0.15)",`
  - Detected: rgba/hsl: `rgba(0,0,0,0.15)`
- **Line 58**: `border: "1px solid rgba(255,255,255,0.08)",`
  - Detected: rgba/hsl: `rgba(255,255,255,0.08)`
- **Line 69**: `bgcolor: "rgba(103, 200, 221, 0.08)",`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.08)`
- **Line 77**: `bgcolor: "rgba(12, 34, 55, 0.6)",`
  - Detected: rgba/hsl: `rgba(12, 34, 55, 0.6)`
- **Line 135**: `? "0 4px 12px rgba(103, 200, 221, 0.25)"`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.25)`

## [PersonalSettings.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/PersonalSettings.tsx)

- **Line 127**: `boxShadow: "0 8px 24px rgba(103, 200, 221, 0.04)",`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.04)`
- **Line 134**: `boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.2)`
- **Line 204**: `bgcolor: "rgba(0,0,0,0.01)",`
  - Detected: rgba/hsl: `rgba(0,0,0,0.01)`

## [PrayerSettings.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/PrayerSettings.tsx)

- **Line 49**: `icon: <WbTwilightIcon className="text-[#FF9F43]" />,`
  - Detected: Hex: `#FF9F43`, Tailwind: `text-[#FF9F43]`
- **Line 50**: `bgColor: "rgba(255, 159, 67, 0.12)",`
  - Detected: rgba/hsl: `rgba(255, 159, 67, 0.12)`
- **Line 55**: `icon: <WbSunnyIcon className="text-[#FFC107]" />,`
  - Detected: Hex: `#FFC107`, Tailwind: `text-[#FFC107]`
- **Line 56**: `bgColor: "rgba(255, 193, 7, 0.12)",`
  - Detected: rgba/hsl: `rgba(255, 193, 7, 0.12)`
- **Line 61**: `icon: <BedtimeIcon className="text-[#9B5DE5]" />,`
  - Detected: Hex: `#9B5DE5`, Tailwind: `text-[#9B5DE5]`
- **Line 62**: `bgColor: "rgba(155, 93, 229, 0.12)",`
  - Detected: rgba/hsl: `rgba(155, 93, 229, 0.12)`
- **Line 73**: `boxShadow: "0 8px 24px rgba(103, 200, 221, 0.04)",`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.04)`
- **Line 82**: `boxShadow: "0 8px 24px rgba(0, 0, 0, 0.2)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.2)`
- **Line 209**: `bgcolor: "rgba(255,255,255,0.01)",`
  - Detected: rgba/hsl: `rgba(255,255,255,0.01)`
- **Line 261**: `bgcolor: "rgba(255,255,255,0.01)",`
  - Detected: rgba/hsl: `rgba(255,255,255,0.01)`

## [CourseItem.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/course-settings/CourseItem.tsx)

- **Line 56**: `const [color, setColor] = useState<string>(course.color ?? "#e0e0e0");`
  - Detected: Hex: `#e0e0e0`
- **Line 142**: `color: course.color || "#67C8DD",`
  - Detected: Hex: `#67C8DD`
- **Line 194**: `? "rgba(103, 200, 221, 0.04)"`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.04)`
- **Line 195**: `: "rgba(255, 255, 255, 0.02)",`
  - Detected: rgba/hsl: `rgba(255, 255, 255, 0.02)`
- **Line 288**: `border: "1px solid rgba(0,0,0,0.15)",`
  - Detected: rgba/hsl: `rgba(0,0,0,0.15)`
- **Line 459**: `? "#ffffff"`
  - Detected: Hex: `#ffffff`
- **Line 460**: `: "rgba(255,255,255,0.06)",`
  - Detected: rgba/hsl: `rgba(255,255,255,0.06)`

## [index.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/course-settings/index.tsx)

- **Line 92**: `boxShadow: "0 8px 24px rgba(0, 0, 0, 0.15)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.15)`
- **Line 95**: `? "#ffffff"`
  - Detected: Hex: `#ffffff`
- **Line 96**: `: "rgba(255, 255, 255, 0.05)",`
  - Detected: rgba/hsl: `rgba(255, 255, 255, 0.05)`
- **Line 105**: `bgcolor: course.color ?? "#e0e0e0",`
  - Detected: Hex: `#e0e0e0`
- **Line 106**: `border: "1px solid rgba(0,0,0,0.15)",`
  - Detected: rgba/hsl: `rgba(0,0,0,0.15)`
- **Line 145**: `? "rgba(0, 0, 0, 0.01)"`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.01)`
- **Line 146**: `: "rgba(255, 255, 255, 0.01)",`
  - Detected: rgba/hsl: `rgba(255, 255, 255, 0.01)`
- **Line 184**: `color: "#67C8DD", // Brand turquoise as default`
  - Detected: Hex: `#67C8DD`
- **Line 316**: `? "0 8px 24px rgba(103, 200, 221, 0.04)"`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.04)`
- **Line 317**: `: "0 8px 24px rgba(0, 0, 0, 0.2)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.2)`
- **Line 435**: `boxShadow: "0 4px 12px rgba(26, 60, 89, 0.1)",`
  - Detected: rgba/hsl: `rgba(26, 60, 89, 0.1)`
- **Line 440**: `"0 6px 16px rgba(26, 60, 89, 0.2)",`
  - Detected: rgba/hsl: `rgba(26, 60, 89, 0.2)`

## [InstructorSourceList.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/course-settings/InstructorSourceList.tsx)

- **Line 33**: `? "0 8px 24px rgba(0, 0, 0, 0.15)"`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.15)`
- **Line 38**: `: "rgba(255, 255, 255, 0.03)",`
  - Detected: rgba/hsl: `rgba(255, 255, 255, 0.03)`
- **Line 49**: `? "0 4px 12px rgba(103, 200, 221, 0.1)"`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.1)`
- **Line 50**: `: "0 4px 12px rgba(0, 0, 0, 0.25)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.25)`
- **Line 130**: `? "rgba(103, 200, 221, 0.02)"`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.02)`
- **Line 131**: `: "rgba(255, 255, 255, 0.01)",`
  - Detected: rgba/hsl: `rgba(255, 255, 255, 0.01)`

## [GroupField.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/group-tree/GroupField.tsx)

- **Line 38**: `color: "#fff",`
  - Detected: Hex: `#fff`

## [MemberField.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/group-tree/MemberField.tsx)

- **Line 43**: `color: "#000",`
  - Detected: Hex: `#000`

## [OutsiderForm.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/outsider-settings/OutsiderForm.tsx)

- **Line 149**: `? "0 8px 24px rgba(103, 200, 221, 0.04)"`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.04)`
- **Line 150**: `: "0 8px 24px rgba(0, 0, 0, 0.2)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.2)`
- **Line 516**: `boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.08)`

## [OutsidersList.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/outsider-settings/OutsidersList.tsx)

- **Line 63**: `? "0 8px 24px rgba(103, 200, 221, 0.04)"`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.04)`
- **Line 64**: `: "0 8px 24px rgba(0, 0, 0, 0.2)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.2)`
- **Line 236**: `? "rgba(0,0,0,0.01)"`
  - Detected: rgba/hsl: `rgba(0,0,0,0.01)`
- **Line 237**: `: "rgba(255,255,255,0.01)",`
  - Detected: rgba/hsl: `rgba(255,255,255,0.01)`
- **Line 245**: `"0 4px 12px rgba(0,0,0,0.03)",`
  - Detected: rgba/hsl: `rgba(0,0,0,0.03)`
- **Line 352**: `boxShadow: "0 4px 12px rgba(26, 60, 89, 0.1)",`
  - Detected: rgba/hsl: `rgba(26, 60, 89, 0.1)`
- **Line 356**: `boxShadow: "0 6px 16px rgba(26, 60, 89, 0.2)",`
  - Detected: rgba/hsl: `rgba(26, 60, 89, 0.2)`

## [VCardQrCode.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/outsider-settings/VCardQrCode.tsx)

- **Line 86**: `bgcolor: "white",`
  - Detected: Named: `bgcolor: "white"`
- **Line 87**: `boxShadow: "0 2px 8px rgba(0,0,0,0.08)",`
  - Detected: rgba/hsl: `rgba(0,0,0,0.08)`

## [RoomFormCard.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/room-settings/RoomFormCard.tsx)

- **Line 278**: `? "rgba(0,0,0,0.01)"`
  - Detected: rgba/hsl: `rgba(0,0,0,0.01)`
- **Line 279**: `: "rgba(255,255,255,0.02)",`
  - Detected: rgba/hsl: `rgba(255,255,255,0.02)`
- **Line 320**: `? "rgba(0,0,0,0.01)"`
  - Detected: rgba/hsl: `rgba(0,0,0,0.01)`
- **Line 321**: `: "rgba(255,255,255,0.02)",`
  - Detected: rgba/hsl: `rgba(255,255,255,0.02)`
- **Line 371**: `boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.08)`
- **Line 436**: `? "0 8px 24px rgba(103, 200, 221, 0.04)"`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.04)`
- **Line 437**: `: "0 8px 24px rgba(0, 0, 0, 0.2)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.2)`

## [RoomListCard.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/room-settings/RoomListCard.tsx)

- **Line 94**: `? "0 8px 24px rgba(103, 200, 221, 0.04)"`
  - Detected: rgba/hsl: `rgba(103, 200, 221, 0.04)`
- **Line 95**: `: "0 8px 24px rgba(0, 0, 0, 0.2)",`
  - Detected: rgba/hsl: `rgba(0, 0, 0, 0.2)`
- **Line 153**: `boxShadow: "0 4px 12px rgba(26, 60, 89, 0.1)",`
  - Detected: rgba/hsl: `rgba(26, 60, 89, 0.1)`
- **Line 157**: `boxShadow: "0 6px 16px rgba(26, 60, 89, 0.2)",`
  - Detected: rgba/hsl: `rgba(26, 60, 89, 0.2)`

## [RoomListItem.tsx](file:///c:/Users/mkupe/Code/system-b15/bluz/ui/src/components/settings-dialog/tabs/global/room-settings/RoomListItem.tsx)

- **Line 147**: `boxShadow: "0 4px 12px rgba(0,0,0,0.03)",`
  - Detected: rgba/hsl: `rgba(0,0,0,0.03)`
