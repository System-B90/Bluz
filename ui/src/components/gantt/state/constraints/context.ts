/**
 * Name: context.ts
 * Purpose: React context definitions for managing Gantt constraints.
 * Created: 2026-04-19
 * Author: Michael K. Steinberg
 */

import { createContext } from "react";

import { CreateConstraintPayload } from "@/api-client/gantt/constraints";
import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";
import { GanttConstraintState } from "@/components/gantt/state/constraints/types";

export type RefreshConstraints = () => Promise<void>;

export type CreateConstraint = (
  payload: Omit<CreateConstraintPayload, 'id'>,
) => Promise<GanttConstraint | undefined>;

export type UpdateConstraint = (
  id: string,
  payload: Partial<CreateConstraintPayload>,
) => Promise<void>;

export type RemoveConstraint = (id: string) => Promise<void>;

export type GanttConstraintContextType = {
  state: GanttConstraintState;
  refreshConstraints: RefreshConstraints;
  createConstraint: CreateConstraint;
  updateConstraint: UpdateConstraint;
  removeConstraint: RemoveConstraint;
};

export const GanttConstraintContext = createContext<
  GanttConstraintContextType | undefined
>(undefined);
