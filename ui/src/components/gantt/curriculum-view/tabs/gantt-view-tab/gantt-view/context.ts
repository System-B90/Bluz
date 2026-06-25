import { createContext, useContext } from "react";

import { GanttContextType } from "@/components/gantt/curriculum-view/tabs/gantt-view-tab/gantt-view/types";

export const GanttContext = createContext<GanttContextType | null>(null);

export const useGanttContext = () => {
    const ctx = useContext(GanttContext);
    if (!ctx)
        throw new Error(
            "useGanttContext must be used within GanttContextProvider",
        );
    return ctx;
};
