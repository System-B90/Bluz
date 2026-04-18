import { createContext, useContext } from 'react';

import { IGanttContext } from './types';

export const GanttContext = createContext<IGanttContext | null>(null);

export const useGanttContext = () =>
{
    const ctx = useContext(GanttContext);
    if (!ctx) throw new Error("useGanttContext must be used within GanttContext.Provider");
    return ctx;
};
