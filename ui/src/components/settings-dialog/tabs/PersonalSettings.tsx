"use client";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import EventIcon from "@mui/icons-material/Event";
import PeopleIcon from "@mui/icons-material/People";
import SchoolIcon from "@mui/icons-material/School";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import LinearProgress from "@mui/material/LinearProgress";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import
{
    memo,
    useCallback,
    useEffect,
    useMemo,
    useReducer,
    useState,
    type ReactNode,
} from "react";

import
{
    apiConnectGoogleCalendar,
    apiDisconnectGoogleCalendar,
    apiGetGoogleCalendarStatus,
    apiSyncGoogleCalendarNow,
} from "@/api-client/google-calendar";
import { requestGoogleAuthCode } from "@/api-client/google-identity";
import { apiGetClasses } from "@/api-client/hive";
import
{
    apiGetPersonalSettings,
    apiSetPersonalSettings,
} from "@/api-client/personal-settings";
import { GoogleCalendarStatus } from "@/api-shared/types/google-calendar";
import { Class, ClassTypeEnum } from "@/api-shared/types/hive";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useHiveUsers } from "@/components/base/HiveUsersProvider";
import { useOutsiders } from "@/components/base/OutsidersProvider";
import { iconBadgeSx, settingsCardSx } from "@/components/settings-dialog/tabs/global/common/styles";

type PersonalState = {
    groups: Array<string>;
    instructors: Array<string>;
    favoriteOutsiders: Array<string>;
    googleCalendarEnabled: boolean;
    googleCalendarSyncAllEvents: boolean;
    aiAssistantEnabled: boolean;
};
type PersonalAction =
    | { type: "ADD_GROUP"; payload: string; }
    | { type: "ADD_INSTRUCTOR"; payload: string; }
    | { type: "ADD_OUTSIDER"; payload: string; }
    | { type: "INITIALIZE"; payload: PersonalState; }
    | { type: "REMOVE_GROUP"; payload: string; }
    | { type: "REMOVE_INSTRUCTOR"; payload: string; }
    | { type: "REMOVE_OUTSIDER"; payload: string; }
    | { type: "SET_AI_ASSISTANT_ENABLED"; payload: boolean; }
    | { type: "SET_GOOGLE_CALENDAR_ENABLED"; payload: boolean; }
    | { type: "SET_GOOGLE_CALENDAR_SYNC_ALL_EVENTS"; payload: boolean; };

function personalSettingsReducer(
    state: PersonalState,
    action: PersonalAction,
): PersonalState
{
    switch (action.type)
    {
    case "INITIALIZE":
        return action.payload;
    case "ADD_GROUP":
        if (state.groups.includes(action.payload)) return state;
        return { ...state, groups: [ ...state.groups, action.payload ] };
    case "REMOVE_GROUP":
        return {
            ...state,
            groups: state.groups.filter((g) => g !== action.payload),
        };
    case "ADD_INSTRUCTOR":
        if (state.instructors.includes(action.payload)) return state;
        return {
            ...state,
            instructors: [ ...state.instructors, action.payload ],
        };
    case "REMOVE_INSTRUCTOR":
        return {
            ...state,
            instructors: state.instructors.filter(
                (i) => i !== action.payload,
            ),
        };
    case "ADD_OUTSIDER":
        if (state.favoriteOutsiders.includes(action.payload)) return state;
        return {
            ...state,
            favoriteOutsiders: [ ...state.favoriteOutsiders, action.payload ],
        };
    case "REMOVE_OUTSIDER":
        return {
            ...state,
            favoriteOutsiders: state.favoriteOutsiders.filter(
                (o) => o !== action.payload,
            ),
        };
    case "SET_GOOGLE_CALENDAR_ENABLED":
        return { ...state, googleCalendarEnabled: action.payload };
    case "SET_GOOGLE_CALENDAR_SYNC_ALL_EVENTS":
        return { ...state, googleCalendarSyncAllEvents: action.payload };
    case "SET_AI_ASSISTANT_ENABLED":
        return { ...state, aiAssistantEnabled: action.payload };
    }
}

type SelectionItem = {
    id: string;
    label: string;
};
type SelectionCardProps = {
    readonly title: string;
    readonly description: string;
    readonly icon: ReactNode;
    readonly colorTheme:
    | "info"
    | "primary"
    | "secondary"
    | "success"
    | "warning";
    readonly availableOptions: ReadonlyArray<SelectionItem>;
    readonly selectedItems: ReadonlyArray<SelectionItem>;
    readonly emptyMessage: string;
    readonly searchLabel: string;
    readonly onAdd: (item: null | SelectionItem) => void;
    readonly onRemove: (id: string) => void;
    noOptionsText?: string;
};

const SelectionCard = memo(function SelectionCard({
    title,
    description,
    icon,
    colorTheme,
    availableOptions,
    selectedItems,
    emptyMessage,
    searchLabel,
    onAdd,
    onRemove,
    noOptionsText = "אין תוצאות",
}: SelectionCardProps)
{
    return (
        <Box
            sx={ { ...settingsCardSx, flex: 1, minWidth: 0, gap: 3, height: "100%" } }
        >
            <Box alignItems="center" display="flex" gap={ 1.5 }>
                <Box sx={ iconBadgeSx(colorTheme) }>
                    { icon }
                </Box>
                <Box>
                    <Typography
                        sx={ {
                            fontWeight: 800,
                            fontSize: "1.1rem",
                            color: "text.primary",
                        } }
                    >
                        { title }
                    </Typography>
                    <Typography
                        sx={ {
                            fontSize: "0.75rem",
                            color: "text.secondary",
                        } }
                    >
                        { description }
                    </Typography>
                </Box>
            </Box>

            <Box>
                <Autocomplete
                    getOptionLabel={ (option) => option.label }
                    noOptionsText={ noOptionsText }
                    onChange={ (_e, val) => onAdd(val) }
                    options={ availableOptions }
                    renderInput={ (params) => (
                        <TextField
                            { ...params }
                            label={ searchLabel }
                            size="small"
                            sx={ {
                                "& .MuiOutlinedInput-root": {
                                    borderRadius: "10px",
                                },
                            } }
                        />
                    ) }
                    value={ null }
                />
            </Box>

            <Box
                sx={ {
                    display: "flex",
                    flexWrap: "wrap",
                    gap: 1,
                    minHeight: 120,
                    alignContent: "flex-start",
                    p: 1.5,
                    borderRadius: "12px",
                    border: "1px dashed",
                    borderColor: "divider",
                    bgcolor: "rgba(0,0,0,0.01)",
                } }
            >
                { selectedItems.length === 0 ? (
                    <Typography
                        sx={ {
                            color: "text.secondary",
                            fontSize: "0.85rem",
                            m: "auto",
                        } }
                    >
                        { emptyMessage }
                    </Typography>
                ) : (
                    selectedItems.map((item) => (
                        <Chip
                            color={ colorTheme }
                            key={ item.id }
                            label={ item.label }
                            onDelete={ () => onRemove(item.id) }
                            size="small"
                            sx={ {
                                borderRadius: "8px",
                                fontWeight: 700,
                                fontSize: "0.8rem",
                                transition: "transform 0.15s ease",
                                "&:hover": { transform: "scale(1.05)" },
                            } }
                            variant="outlined"
                        />
                    ))
                ) }
            </Box>
        </Box>
    );
});

export function PersonalSettings()
{
    const { enqueueSnackbar } = useSnackbar();
    const { outsiders, getOutsider } = useOutsiders();
    const { instructors: hiveInstructors } = useHiveUsers();
    const [ hiveClasses, setHiveClasses ] = useState<Array<Class>>([]);

    const [ state, dispatch ] = useReducer(personalSettingsReducer, {
        groups: [],
        instructors: [],
        favoriteOutsiders: [],
        googleCalendarEnabled: false,
        googleCalendarSyncAllEvents: false,
        aiAssistantEnabled: true,
    });
    const [ isLoaded, setIsLoaded ] = useState(false);
    const [ googleStatus, setGoogleStatus ] = useState<GoogleCalendarStatus | null>(null);
    const [ googleBusy, setGoogleBusy ] = useState(false);
    const [ googleSyncing, setGoogleSyncing ] = useState(false);

    const refreshGoogleStatus = useCallback(() =>
    {
        apiGetGoogleCalendarStatus({})
            .then(setGoogleStatus)
            // Offline deployments / unconfigured server: treat as "unavailable", not an error.
            .catch(() => setGoogleStatus({
                configured: false,
                connected: false,
                enabled: false,
                clientId: "",
                scopes: [],
            }));
    }, []);

    useEffect(() =>
    {
        refreshGoogleStatus();
    }, [ refreshGoogleStatus ]);

    // Load saved preferences from the server (once on mount)
    useEffect(() =>
    {
        apiGetPersonalSettings({})
            .then((settings) =>
            {
                dispatch({ type: "INITIALIZE", payload: settings });
                // Only a successful load may arm the persist effect: arming
                // it after a failure PUT the reducer defaults and wiped the
                // user's saved groups/instructors/favourites.
                setIsLoaded(true);
            })
            .catch((e) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "כשל בטעינת העדפות אישיות",
                    e,
                ),
            );
        // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount only
    }, []);

    // Persist preferences whenever state changes (skip the initial load)
    useEffect(() =>
    {
        if (!isLoaded) return;
        apiSetPersonalSettings(state, {}).catch((e) =>
            enqueueApiErrorSnackbar(
                enqueueSnackbar,
                "כשל בשמירת העדפות אישיות",
                e,
            ),
        );
    }, [ state, isLoaded, enqueueSnackbar ]);

    // Load student groups from Hive
    useEffect(() =>
    {
        apiGetClasses({})
            .then((classes) =>
                setHiveClasses(
                    classes.filter(
                        (c) => c.type === ClassTypeEnum.Student_Group,
                    ),
                ),
            )
            .catch((e) =>
                enqueueApiErrorSnackbar(
                    enqueueSnackbar,
                    "כשל בטעינת קבוצות",
                    e,
                ),
            );
    }, [ enqueueSnackbar ]);

    const handleAddGroup = useCallback(
        (group: null | SelectionItem) =>
        {
            if (!group) return;
            dispatch({ type: "ADD_GROUP", payload: group.id });
            enqueueSnackbar("הקבוצה התווספה בהצלחה.", { variant: "success" });
        },
        [ enqueueSnackbar ],
    );

    const handleRemoveGroup = useCallback(
        (id: string) =>
        {
            dispatch({ type: "REMOVE_GROUP", payload: id });
            enqueueSnackbar("הקבוצה הוסרה בהצלחה.", { variant: "success" });
        },
        [ enqueueSnackbar ],
    );

    const handleAddInstructor = useCallback(
        (instructor: null | SelectionItem) =>
        {
            if (!instructor) return;
            dispatch({ type: "ADD_INSTRUCTOR", payload: instructor.id });
            enqueueSnackbar("המרצה התווסף בהצלחה.", { variant: "success" });
        },
        [ enqueueSnackbar ],
    );

    const handleRemoveInstructor = useCallback(
        (id: string) =>
        {
            dispatch({ type: "REMOVE_INSTRUCTOR", payload: id });
            enqueueSnackbar("המרצה הוסר בהצלחה.", { variant: "success" });
        },
        [ enqueueSnackbar ],
    );

    const handleAddOutsider = useCallback(
        (outsider: null | SelectionItem) =>
        {
            if (!outsider) return;
            dispatch({ type: "ADD_OUTSIDER", payload: outsider.id });
            enqueueSnackbar("איש החוץ התווסף למועדפים בהצלחה.", {
                variant: "success",
            });
        },
        [ enqueueSnackbar ],
    );

    const handleRemoveOutsider = useCallback(
        (id: string) =>
        {
            dispatch({ type: "REMOVE_OUTSIDER", payload: id });
            enqueueSnackbar("איש החוץ הוסר מהמועדפים בהצלחה.", {
                variant: "success",
            });
        },
        [ enqueueSnackbar ],
    );

    const handleToggleGoogleCalendar = useCallback(
        async (enabled: boolean) =>
        {
            dispatch({ type: "SET_GOOGLE_CALENDAR_ENABLED", payload: enabled });
            if (!enabled) return;

            // Turning the toggle on with no linked Google account: run the
            // "Continue with Google" popup (GIS code model) and hand the
            // resulting authorization code to the server.
            if (!googleStatus?.connected && googleStatus?.clientId)
            {
                setGoogleBusy(true);
                try
                {
                    const code = await requestGoogleAuthCode(
                        googleStatus.clientId,
                        googleStatus.scopes,
                    );
                    await apiConnectGoogleCalendar({ code }, {});
                    refreshGoogleStatus();
                    enqueueSnackbar("חשבון Google חובר בהצלחה.", { variant: "success" });
                }
                catch (e)
                {
                    dispatch({ type: "SET_GOOGLE_CALENDAR_ENABLED", payload: false });
                    enqueueApiErrorSnackbar(enqueueSnackbar, "כשל בחיבור ל-Google Calendar", e);
                }
                finally
                {
                    setGoogleBusy(false);
                }
            }
        },
        [ enqueueSnackbar, googleStatus, refreshGoogleStatus ],
    );

    const handleDisconnectGoogle = useCallback(async () =>
    {
        setGoogleBusy(true);
        try
        {
            await apiDisconnectGoogleCalendar({});
            dispatch({ type: "SET_GOOGLE_CALENDAR_ENABLED", payload: false });
            refreshGoogleStatus();
            enqueueSnackbar("החיבור ל-Google Calendar נותק.", { variant: "success" });
        }
        catch (e)
        {
            enqueueApiErrorSnackbar(enqueueSnackbar, "כשל בניתוק Google Calendar", e);
        }
        finally
        {
            setGoogleBusy(false);
        }
    }, [ enqueueSnackbar, refreshGoogleStatus ]);

    const handleSyncGoogleNow = useCallback(async () =>
    {
        setGoogleSyncing(true);
        try
        {
            const result = await apiSyncGoogleCalendarNow({});
            enqueueSnackbar(
                `סונכרנו ${result.pushed} אירועים מ-Bluz, עודכנו ${result.updated} אירועים מעריכות ב-Google, נמצאו ${result.pulled} חסימות עומס.`,
                { variant: "success" },
            );
        }
        catch (e)
        {
            enqueueApiErrorSnackbar(enqueueSnackbar, "כשל בסנכרון עם Google Calendar", e);
        }
        finally
        {
            setGoogleSyncing(false);
        }
    }, [ enqueueSnackbar ]);

    // SelectionCard is memoized, but a freshly-mapped array is a new
    // reference every render regardless of whether its contents changed —
    // memoize on the actual dependencies so the memo can do its job.
    const availableGroups = useMemo(
        () =>
            hiveClasses
                .filter((c) => !state.groups.includes(String(c.id)))
                .map((c) => ({ id: String(c.id), label: c.display_name })),
        [ hiveClasses, state.groups ],
    );
    const selectedGroups = useMemo(
        () =>
            state.groups.map((id) =>
            {
                const c = hiveClasses.find((g) => String(g.id) === id);
                return { id, label: c ? c.display_name : id };
            }),
        [ state.groups, hiveClasses ],
    );

    const availableInstructors = useMemo(
        () =>
            hiveInstructors
                .filter((i) => !state.instructors.includes(String(i.id)))
                .map((i) => ({ id: String(i.id), label: i.display_name })),
        [ hiveInstructors, state.instructors ],
    );
    const selectedInstructors = useMemo(
        () =>
            state.instructors.map((id) =>
            {
                const i = hiveInstructors.find((u) => String(u.id) === id);
                return { id, label: i ? i.display_name : id };
            }),
        [ state.instructors, hiveInstructors ],
    );

    const availableOutsiders = useMemo(
        () =>
            outsiders
                .filter((o) => !state.favoriteOutsiders.includes(o.id))
                .map((o) => ({ id: o.id, label: o.name })),
        [ outsiders, state.favoriteOutsiders ],
    );
    const selectedOutsiders = useMemo(
        () =>
            state.favoriteOutsiders.map((id) =>
            {
                const o = getOutsider(id);
                return { id, label: o ? o.name : id };
            }),
        [ state.favoriteOutsiders, getOutsider ],
    );

    return (
        <Box
            sx={ {
                display: "flex",
                flexDirection: "column",
                gap: 3,
                width: "100%",
            } }
        >
            <Box
                sx={ {
                    display: "flex",
                    flexDirection: { xs: "column", lg: "row" },
                    gap: 3,
                    alignItems: "stretch",
                    justifyContent: "center",
                    width: "100%",
                } }
            >
                <SelectionCard
                    availableOptions={ availableGroups }
                    colorTheme="primary"
                    description="בחירת קבוצות להצגה מותאמת ביומן"
                    emptyMessage="טרם נבחרו קבוצות"
                    icon={ <PeopleIcon className="text-[20px]" /> }
                    noOptionsText="אין קבוצות"
                    onAdd={ handleAddGroup }
                    onRemove={ handleRemoveGroup }
                    searchLabel="חיפוש והוספת קבוצה..."
                    selectedItems={ selectedGroups }
                    title="קבוצות שלי"
                />
                <SelectionCard
                    availableOptions={ availableInstructors }
                    colorTheme="secondary"
                    description="מעקב אחר מרצים מבוקשים ביומן"
                    emptyMessage="טרם נבחרו מרצים"
                    icon={ <SchoolIcon className="text-[20px]" /> }
                    onAdd={ handleAddInstructor }
                    onRemove={ handleRemoveInstructor }
                    searchLabel="חיפוש והוספת מרצה..."
                    selectedItems={ selectedInstructors }
                    title="מרצים מועדפים"
                />
            </Box>
            <Box
                sx={ {
                    display: "flex",
                    width: "100%",
                } }
            >
                <SelectionCard
                    availableOptions={ availableOutsiders }
                    colorTheme="warning"
                    description="בחירת אנשי חוץ מועדפים שיופיעו בראש הרשימה ביומן"
                    emptyMessage="טרם נבחרו אנשי חוץ מועדפים"
                    icon={ <AssignmentIndIcon className="text-[20px]" /> }
                    onAdd={ handleAddOutsider }
                    onRemove={ handleRemoveOutsider }
                    searchLabel="חיפוש והוספת איש חוץ..."
                    selectedItems={ selectedOutsiders }
                    title="אנשי חוץ מועדפים"
                />
            </Box>
            <Box sx={ { display: "flex", width: "100%" } }>
                <Box sx={ { ...settingsCardSx, flex: 1, minWidth: 0, gap: 2 } }>
                    <Box alignItems="center" display="flex" gap={ 1.5 }>
                        <Box sx={ iconBadgeSx("info") }>
                            <EventIcon className="text-[20px]" />
                        </Box>
                        <Box flex={ 1 }>
                            <Typography sx={ { fontWeight: 800, fontSize: "1.1rem", color: "text.primary" } }>
                                Google Calendar
                            </Typography>
                            <Typography sx={ { fontSize: "0.75rem", color: "text.secondary" } }>
                                סנכרון דו-כיווני: האירועים שלך נשלחים ליומן Google ייעודי,
                                ועריכות שתבצעו שם (שם, שעות, הערות) חוזרות ל-Bluz.
                                החיבור בלחיצת &quot;התחברות עם Google&quot; — ללא הגדרה בצד השרת.
                            </Typography>
                        </Box>
                        <Switch
                            checked={ state.googleCalendarEnabled }
                            disabled={ googleBusy || !googleStatus?.configured }
                            onChange={ (_e, checked) => handleToggleGoogleCalendar(checked) }
                        />
                    </Box>
                    { !googleStatus?.configured && (
                        <Typography sx={ { fontSize: "0.75rem", color: "text.secondary" } }>
                            האינטגרציה אינה מוגדרת בשרת זה (מתאים לפריסות ללא גישה לאינטרנט).
                        </Typography>
                    ) }
                    { state.googleCalendarEnabled && googleStatus?.connected ? <>
                        <Box alignItems="center" display="flex" gap={ 1.5 }>
                            <Box flex={ 1 }>
                                <Typography sx={ { fontWeight: 600, fontSize: "0.9rem", color: "text.primary" } }>
                                סנכרון כל אירועי הלו&quot;ז
                                </Typography>
                                <Typography sx={ { fontSize: "0.75rem", color: "text.secondary" } }>
                                כברירת מחדל מסונכרנים רק אירועים שבהם אתם משבצים כמדריכים/מרצים.
                                הפעילו כדי לסנכרן את כל אירועי הלו&quot;ז, ללא קשר לשיבוץ.
                                </Typography>
                            </Box>
                            <Switch
                                checked={ state.googleCalendarSyncAllEvents }
                                disabled={ googleBusy }
                                onChange={ (_e, checked) => dispatch({ type: "SET_GOOGLE_CALENDAR_SYNC_ALL_EVENTS", payload: checked }) }
                            />
                        </Box>
                        <Box display="flex" flexDirection="column" gap={ 0.75 }>
                            <Box display="flex" gap={ 1.5 }>
                                <Button
                                    disabled={ googleBusy || googleSyncing }
                                    onClick={ handleSyncGoogleNow }
                                    size="small"
                                    startIcon={ googleSyncing ? <CircularProgress size={ 14 } /> : null }
                                    variant="outlined"
                                >
                                    { googleSyncing ? "מסנכרן..." : "סנכרן עכשיו" }
                                </Button>
                                <Button
                                    color="error"
                                    disabled={ googleBusy || googleSyncing }
                                    onClick={ handleDisconnectGoogle }
                                    size="small"
                                    variant="text"
                                >
                                    נתק חשבון
                                </Button>
                            </Box>
                            { googleSyncing ? <LinearProgress sx={ { borderRadius: 1, height: 4 } } /> : null }
                        </Box>
                    </> : null }
                </Box>
            </Box>
            <Box sx={ { display: "flex", width: "100%" } }>
                <Box sx={ { ...settingsCardSx, flex: 1, minWidth: 0, gap: 2 } }>
                    <Box alignItems="center" display="flex" gap={ 1.5 }>
                        <Box sx={ iconBadgeSx("secondary") }>
                            <AutoAwesomeIcon className="text-[20px]" />
                        </Box>
                        <Box flex={ 1 }>
                            <Typography sx={ { fontWeight: 800, fontSize: "1.1rem", color: "text.primary" } }>
                                עוזר AI
                            </Typography>
                            <Typography sx={ { fontSize: "0.75rem", color: "text.secondary" } }>
                                מציג/מסתיר את כפתור עוזר ה-AI הצף בלו&quot;ז ובגאנט.
                            </Typography>
                        </Box>
                        <Switch
                            checked={ state.aiAssistantEnabled }
                            onChange={ (_e, checked) => dispatch({ type: "SET_AI_ASSISTANT_ENABLED", payload: checked }) }
                        />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
