"use client";
import EventIcon from "@mui/icons-material/Event";
import SchoolIcon from "@mui/icons-material/School";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import { Command, useCommands } from "@system-b90/command-palette";
import { ReactNode, useCallback } from "react";

import { COMMAND_GROUPS } from "@/components/app-commands/labels";
import { useGanttSearchNav } from "@/components/gantt/curriculum-view/search/GanttSearchNavProvider";
import {
    GanttSearchItem,
    GanttSearchItemType,
    useGanttSearchItems,
} from "@/components/gantt/curriculum-view/search/use-gantt-search-items";
import { useCurriculumProviderActions } from "@/components/gantt/state/context";

const ICONS: Record<GanttSearchItemType, ReactNode> = {
    syllabus: <SchoolIcon />,
    module: <ViewModuleIcon />,
    event: <EventIcon />,
};

const TYPE_KEYWORDS: Record<GanttSearchItemType, Array<string>> = {
    syllabus: ["syllabus", "סילבוס"],
    module: ["module", "מערך"],
    event: ["event", "מופע"],
};

/**
 * How many items to show before the user has typed anything. The loaded
 * curriculum can hold thousands of events, and dumping all of them into an
 * unfiltered list is neither useful nor cheap.
 */
const UNFILTERED_LIMIT = 20;

type Openers = ReturnType<typeof useCurriculumProviderActions> & {
    goToSyllabus: (syllabusId: GanttSearchItem["syllabusId"]) => void;
};

/**
 * Scroll to the owning syllabus, then open the item's own dialog. An event
 * opens over its module's dialog, the same stack an event deep link restores.
 */
function openItem(item: GanttSearchItem, openers: Openers): void {
    const { syllabusId, moduleId, eventId } = item;
    openers.goToSyllabus(syllabusId);

    if (item.type === "syllabus") {
        openers.openSyllabusDialog(syllabusId);
    } else if (item.type === "module" && moduleId) {
        openers.openModuleDialog(syllabusId, moduleId);
    } else if (item.type === "event" && moduleId && eventId) {
        openers.openModuleDialog(syllabusId, moduleId, eventId);
        openers.openEventDialog(syllabusId, moduleId, eventId);
    }
}

function toCommand(item: GanttSearchItem, openers: Openers): Command {
    return {
        id: `gantt.${item.type}.${item.id}`,
        title: item.title,
        subtitle: item.path,
        group: COMMAND_GROUPS.gantt,
        kind: "entity",
        icon: ICONS[item.type],
        keywords: TYPE_KEYWORDS[item.type],
        run: () => openItem(item, openers),
    };
}

/**
 * Contributes the loaded curriculum's syllabuses, modules and events to the
 * entity lane, reusing the same flattened item list and scroll-into-view
 * navigation as the gantt view's own inline search.
 *
 * Renders nothing — mount it inside `CurriculumView`, where both the curriculum
 * state and the search-nav context are available.
 */
export function GanttContentCommands() {
    const items = useGanttSearchItems();
    const { goToSyllabus } = useGanttSearchNav();
    const actions = useCurriculumProviderActions();

    const factory = useCallback(
        (query: { text: string }) => {
            const source = query.text
                ? items
                : items.slice(0, UNFILTERED_LIMIT);
            const openers = { ...actions, goToSyllabus };
            return source.map((item) => toCommand(item, openers));
        },
        [items, goToSyllabus, actions],
    );

    useCommands(factory);

    return null;
}
