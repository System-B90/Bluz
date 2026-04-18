"use client";

import Box from "@mui/material/Box";
import CircularProgress from "@mui/material/CircularProgress";
import { Gantt, Willow } from "@svar-ui/react-gantt";
import { useEffect, useMemo, useState } from "react";

export interface ITask {
  id: number | string;
  text?: string;
  start?: Date;
  end?: Date;
  duration?: number;
  progress?: number;
  type?: "milestone" | "summary" | "task";
  parent?: number | string;
  open?: boolean;
  lazy?: boolean;
  [key: string]: any;
}

export interface ILink {
  id: number | string;
  source: number | string;
  target: number | string;
  type: "e2e" | "e2s" | "s2e" | "s2s";
}

interface BluzGanttProps {
  initialTasks: ITask[];
  initialLinks: ILink[];
}

export default function BluzGantt({
  initialTasks,
  initialLinks,
}: BluzGanttProps) {
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  // Defensive Normalization: Force all IDs to strings to prevent Issue #16
  // where the Bluz backend might return integers, breaking Gantt tree traversal.
  const normalizedTasks = useMemo(
    () =>
      initialTasks.map((task) => ({
        ...task,
        id: String(task.id),
        parent:
          task.parent !== undefined && task.parent !== null
            ? String(task.parent)
            : undefined,
      })),
    [initialTasks],
  );

  const normalizedLinks = useMemo(
    () =>
      initialLinks.map((link) => ({
        ...link,
        id: String(link.id),
        source: String(link.source),
        target: String(link.target),
      })),
    [initialLinks],
  );

  if (!isHydrated) {
    return (
      <Box className="flex items-center justify-center h-full w-full bg-gray-50">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box className="h-full w-full flex-1 min-h-0">
      <Willow>
        <Gantt links={normalizedLinks} tasks={normalizedTasks} />
      </Willow>
    </Box>
  );
}
