import { useContext } from "react";

import {
    CurriculumListContext,
    CurriculumListContextType,
} from "@/components/gantt/state/curriculum-list/context";

export function useCurriculumList(): CurriculumListContextType {
    const context = useContext(CurriculumListContext);
    if (!context) {
        throw new Error(
            "useCurriculumList must be used within a CurriculumListProvider",
        );
    }
    return context;
}
