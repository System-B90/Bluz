"use client";

import Box from "@mui/material/Box";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";

import { Event } from "@/components/schedule/types/event";

export function EventToggles({
    event,
    onUpdate,
}: {
    event: Partial<Event>;
    onUpdate: (u: Partial<Event>) => void;
})
{
    const toggles = [
        { label: "מתואם", key: "locked" },
        { label: "קריטי", key: "required" },
        { label: 'חלון פ"א', key: "personalTalk" },
        { label: "מוסתר", key: "hidden" },
    ] as const;

    return (
        <Box display="flex" gap={ 2 }>
            { toggles.map(({ label, key }) => (
                <FormControlLabel
                    control={
                        <Switch
                            checked={ !!event[ key ] }
                            onChange={ (e) =>
                                onUpdate({ [ key ]: e.target.checked })
                            }
                        />
                    }
                    key={ key }
                    label={ label }
                />
            )) }
            <FormControlLabel
                control={
                    <Switch
                        checked={ !!event.fake }
                        onChange={ (e) =>
                            // Fake events are detached from Hive: clear the
                            // subject/module/lesson wiring when toggled on.
                            onUpdate(
                                e.target.checked
                                    ? {
                                        fake: true,
                                        subject: 0,
                                        hiveModule: 0,
                                        hiveLesson: null,
                                    }
                                    : { fake: false },
                            )
                        }
                    />
                }
                label="פיקטיבי"
            />
        </Box>
    );
}
