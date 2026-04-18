import { GanttEventId } from "@/api-shared/types/gantt/models/event";
import { GanttModuleId } from "@/api-shared/types/gantt/models/module";
import { GanttSyllabusId } from "@/api-shared/types/gantt/models/syllabus";

export enum GanttEventRequirementRelation
{
    // The event must occur before the _other_ begins
    EndsBefore = 'ends-before',
    // The event will only happen after the entirety of the _other_ has ended
    StartsAfter = 'starts-after-end',
}

// An event can be dependant on before/after the following types
export enum GanttEventRequirementDependencyType
{
    Event = 'event',
    Module = 'module',
    Syllabus = 'syllabus',
}

export type GanttEventRequirements = {
    relation: GanttEventRequirementRelation;
    dependencyType: GanttEventRequirementDependencyType.Event;
    dependencyId: GanttEventId;
} | {
    relation: GanttEventRequirementRelation;
    dependencyType: GanttEventRequirementDependencyType.Module;
    dependencyId: GanttModuleId;
} | {
    relation: GanttEventRequirementRelation;
    dependencyType: GanttEventRequirementDependencyType.Syllabus;
    dependencyId: GanttSyllabusId;
};
