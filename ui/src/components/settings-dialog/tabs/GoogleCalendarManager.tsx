"use client";
import GroupIcon from "@mui/icons-material/Group";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Typography from "@mui/material/Typography";
import { useSnackbar } from "notistack";
import { memo, useCallback, useEffect, useState } from "react";

import
{
    apiListGoogleCalendars,
    apiPurgeGoogleCalendar,
    apiSelectGoogleCalendar,
} from "@/api-client/google-calendar";
import
{
    GoogleCalendarOption,
    GoogleCalendarPurgeScope,
    GoogleCalendarSelection,
} from "@/api-shared/types/google-calendar";
import { enqueueApiErrorSnackbar } from "@/components/base/ApiErrorSnackbar";
import { useConfirmDialog } from "@/components/base/UseConfirmDialog";

const CREATE_NEW_VALUE = "__create_new__";

type GoogleCalendarManagerProps = {
    calendar: GoogleCalendarSelection;
    disabled?: boolean;
    /** Called after the link changed (calendar switched) so the parent refetches status. */
    onChanged: () => void;
};

/**
 * The connected-state extras of the Google Calendar card: which calendar the
 * link mirrors into (own or shared — several users can pick the same one),
 * which iteration it is bound to, and the purge actions that remove Bluz
 * copies Google still holds.
 */
export const GoogleCalendarManager = memo(function GoogleCalendarManager({ calendar, disabled, onChanged }: GoogleCalendarManagerProps)
{
    const { enqueueSnackbar } = useSnackbar();
    const { confirm, confirmDialog } = useConfirmDialog();
    const [ options, setOptions ] = useState<Array<GoogleCalendarOption> | null>(null);
    const [ loadingOptions, setLoadingOptions ] = useState(false);
    const [ switching, setSwitching ] = useState(false);
    const [ purging, setPurging ] = useState<GoogleCalendarPurgeScope | null>(null);

    const loadOptions = useCallback(() =>
    {
        setLoadingOptions(true);
        apiListGoogleCalendars({})
            .then(({ calendars }) => setOptions(calendars))
            .catch((e) =>
            {
                // Offline / Google unreachable: the picker degrades to the
                // linked calendar alone; nothing else on the card depends on
                // the list.
                setOptions([]);
                enqueueApiErrorSnackbar(enqueueSnackbar, "לא ניתן לטעון את רשימת היומנים מ-Google", e);
            })
            .finally(() => setLoadingOptions(false));
    }, [ enqueueSnackbar ]);

    useEffect(() =>
    {
        // Subscribes to Google's calendar list; state lands in the callbacks.
        const timer = setTimeout(loadOptions, 0);
        return () => clearTimeout(timer);
    }, [ loadOptions ]);

    const handleSelect = useCallback(async (value: string) =>
    {
        if (value === calendar.id) return;
        setSwitching(true);
        try
        {
            const selected = await apiSelectGoogleCalendar(
                value === CREATE_NEW_VALUE ? { createNew: true } : { calendarId: value },
                {},
            );
            enqueueSnackbar(`היומן "${selected.summary}" חובר. הריצו "סנכרן עכשיו" כדי למלא אותו.`, { variant: "success" });
            onChanged();
            loadOptions();
        }
        catch (e)
        {
            enqueueApiErrorSnackbar(enqueueSnackbar, "כשל בהחלפת היומן", e);
        }
        finally
        {
            setSwitching(false);
        }
    }, [ calendar.id, enqueueSnackbar, loadOptions, onChanged ]);

    const handlePurge = useCallback(async (scope: GoogleCalendarPurgeScope) =>
    {
        const approved = await confirm(
            scope === "all"
                ? `כל האירועים ש-Bluz יצר ביומן "${calendar.summary}" יימחקו מ-Google. אירועים שנוצרו ידנית ב-Google לא ייפגעו. להמשיך?`
                : `אירועים ביומן "${calendar.summary}" שאין להם עוד אירוע תואם ב-Bluz (נמחקו, שייכים למחזור אחר, או יצאו מטווח הסנכרון שלכם) יימחקו מ-Google. להמשיך?`,
            {
                title: scope === "all" ? "הסרת כל אירועי Bluz מהיומן" : "הסרת אירועים יתומים",
                confirmLabel: "הסר",
            },
        );
        if (!approved) return;
        setPurging(scope);
        try
        {
            const result = await apiPurgeGoogleCalendar({ scope }, {});
            enqueueSnackbar(
                `נסרקו ${result.scanned} אירועי Bluz ביומן, הוסרו ${result.removed}` +
                    (result.failed ? `, נכשלו ${result.failed}` : "") + ".",
                { variant: result.failed ? "warning" : "success" },
            );
        }
        catch (e)
        {
            enqueueApiErrorSnackbar(enqueueSnackbar, "כשל בהסרת אירועים מ-Google Calendar", e);
        }
        finally
        {
            setPurging(null);
        }
    }, [ calendar.summary, confirm, enqueueSnackbar ]);

    // The linked calendar always appears, even when Google's list failed or
    // no longer includes it (access revoked) — the user must see what is set.
    const listed = options ?? [];
    const menuOptions = listed.some((o) => o.id === calendar.id)
        ? listed
        : [ { id: calendar.id, summary: calendar.summary, accessRole: calendar.accessRole ?? "writer", primary: false, shared: calendar.accessRole === "writer" }, ...listed ];
    const busy = disabled || switching || purging !== null;

    return (
        <Box display="flex" flexDirection="column" gap={ 1.5 }>
            <Box alignItems="center" display="flex" flexWrap="wrap" gap={ 1.5 }>
                <FormControl size="small" sx={ { minWidth: 260, flex: 1 } }>
                    <InputLabel id="google-calendar-select-label">יומן יעד ב-Google</InputLabel>
                    <Select
                        disabled={ busy }
                        label="יומן יעד ב-Google"
                        labelId="google-calendar-select-label"
                        onChange={ (event) => void handleSelect(String(event.target.value)) }
                        value={ calendar.id }
                    >
                        { menuOptions.map((option) => (
                            <MenuItem key={ option.id } value={ option.id }>
                                <Box alignItems="center" display="flex" gap={ 1 }>
                                    <span>{ option.summary }</span>
                                    { option.shared ? <Chip label="משותף" size="small" /> : null }
                                    { option.primary ? <Chip label="ראשי" size="small" variant="outlined" /> : null }
                                </Box>
                            </MenuItem>
                        )) }
                        <MenuItem value={ CREATE_NEW_VALUE }>+ יומן חדש עבור המחזור הנוכחי</MenuItem>
                    </Select>
                </FormControl>
                { loadingOptions || switching ? <CircularProgress size={ 18 } /> : null }
            </Box>
            <Box alignItems="center" display="flex" flexWrap="wrap" gap={ 1 }>
                { calendar.iterationLabel ? (
                    <Chip label={ `מחזור: ${calendar.iterationLabel}` } size="small" variant="outlined" />
                ) : (
                    <Chip color="warning" label="לא מקושר למחזור (מסנכרן את המחזור הנוכחי)" size="small" variant="outlined" />
                ) }
                <Chip
                    icon={ <GroupIcon /> }
                    label={ calendar.linkedUsers > 1
                        ? `${calendar.linkedUsers} משתמשים מסנכרנים ליומן זה`
                        : "רק אתם מסנכרנים ליומן זה" }
                    size="small"
                    variant="outlined"
                />
            </Box>
            <Typography sx={ { fontSize: "0.75rem", color: "text.secondary" } }>
                כדי שכמה אנשי צוות יסנכרנו לאותו יומן: בעל היומן משתף אותו ב-Google עם הרשאת
                &quot;לבצע שינויים באירועים&quot;, וכל אחד בוחר אותו כאן. כל אירוע נכתב ליומן פעם אחת.
            </Typography>
            <Box display="flex" flexWrap="wrap" gap={ 1.5 }>
                <Button
                    disabled={ busy }
                    onClick={ () => void handlePurge("orphaned") }
                    size="small"
                    startIcon={ purging === "orphaned" ? <CircularProgress size={ 14 } /> : null }
                    variant="outlined"
                >
                    הסר אירועים יתומים
                </Button>
                <Button
                    color="error"
                    disabled={ busy }
                    onClick={ () => void handlePurge("all") }
                    size="small"
                    startIcon={ purging === "all" ? <CircularProgress size={ 14 } /> : null }
                    variant="outlined"
                >
                    הסר את כל אירועי Bluz מהיומן
                </Button>
            </Box>
            { confirmDialog }
        </Box>
    );
});
