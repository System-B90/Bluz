import { createContext } from "react";

import { CreateConstraintPayload } from "@/api-client/gantt/constraints";
import { GanttConstraint } from "@/api-shared/types/gantt/models/constraint";
import { GanttConstraintState } from "@/components/gantt/state/constraints/types";

/**
 * Type signature for the function that refreshes the loaded constraints from the API.
 */
export type RefreshConstraints = () => Promise<void>;

/**
 * Type signature for the function that creates a new constraint.
 * 
 * @param payload - The constraint details excluding its ID.
 * @returns The created constraint or undefined if creation failed.
 */
export type CreateConstraint = (
    payload: Omit<CreateConstraintPayload, "id">,
) => Promise<GanttConstraint | undefined>;

/**
 * Type signature for the function that updates an existing constraint.
 * 
 * @param id - The unique constraint identifier.
 * @param payload - The fields to update.
 */
export type UpdateConstraint = (
    id: string,
    payload: Partial<CreateConstraintPayload>,
) => Promise<void>;

/**
 * Type signature for the function that deletes a constraint.
 * 
 * @param id - The unique identifier of the constraint to delete.
 */
export type RemoveConstraint = (id: string) => Promise<void>;

/**
 * The structured type of the Gantt constraints context value.
 */
export type GanttConstraintContextType = {
    /** The current state of constraints in the store. */
    state: GanttConstraintState;
    
    /** Function to refresh constraints from server. */
    refreshConstraints: RefreshConstraints;
    
    /** Function to create a new constraint. */
    createConstraint: CreateConstraint;
    
    /** Function to update an existing constraint. */
    updateConstraint: UpdateConstraint;
    
    /** Function to delete a constraint. */
    removeConstraint: RemoveConstraint;
};

/**
 * React context for managing and sharing Gantt constraints.
 */
export const GanttConstraintContext = createContext<
    GanttConstraintContextType | undefined
>(undefined);
