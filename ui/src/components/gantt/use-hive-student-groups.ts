import { useEffect, useState } from "react";

import { apiGetClasses } from "@/api-client/hive";
import { normalizeShuffleName } from "@/api-shared/gantt/shuffle-names";
import { Class } from "@/api-shared/types/hive";

type HiveStudentGroups = Map<string, Class>;

// One fetch shared by every mounted consumer: a module dialog renders a chip
// per event row, and each one asking Hive on its own would flood it.
let inFlight: null | Promise<HiveStudentGroups> = null;

function loadHiveStudentGroups(): Promise<HiveStudentGroups> {
    inFlight ??= apiGetClasses()
        .then(
            (fetched) =>
                new Map(
                    fetched.map((group) => [normalizeShuffleName(group.name), group]),
                ),
        )
        .finally(() => {
            inFlight = null;
        });
    return inFlight;
}

/**
 * Hive student groups, keyed by normalized name. A shuffle is 1:1 with a Hive
 * student group matched by name (see `resolveDesiredRules`), so this tells a
 * shuffle whether it is linked and what its Hive description is. `null` while
 * loading or when Hive is unreachable: callers must still work offline.
 */
export function useHiveStudentGroups(): HiveStudentGroups | null {
    const [groups, setGroups] = useState<HiveStudentGroups | null>(null);

    useEffect(() => {
        let cancelled = false;
        loadHiveStudentGroups()
            .then((loaded) => {
                if (!cancelled) setGroups(loaded);
            })
            .catch(() => {
                if (!cancelled) setGroups(null);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    return groups;
}
