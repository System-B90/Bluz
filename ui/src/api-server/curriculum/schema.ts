import { relations } from "drizzle-orm";
import
    {
        boolean,
        integer,
        jsonb,
        pgEnum,
        pgTable,
        primaryKey,
        real,
        text,
        timestamp
    } from "drizzle-orm/pg-core";

export const moduleEventTypeEnum = pgEnum('module_event_type', [
    'הרצאה',
    'ע"ע',
    'ל"ע',
    'אחר'
]);

export const curriculums = pgTable('c', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    draft: boolean('draft').notNull().default(true),
    weeks: jsonb('weeks').$type<any[]>().notNull().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const syllabuses = pgTable('s', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    hiveIds: integer('hive_ids').array().notNull().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const modules = pgTable('m', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    description: text('description').notNull().default(''),
    hiveIds: integer('hive_ids').array().notNull().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const moduleEvents = pgTable('e', {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    type: moduleEventTypeEnum('type').notNull(),
    minimumDuration: integer('minimum_duration').notNull().default(0),
    requirements: jsonb('requirements').$type<any[]>().notNull().default([]),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

/**
 * Maps specific durations to an event within the context of a curriculum.
 */
export const curriculumEventConfigurations = pgTable('cEC', {
    curriculumId: text('curriculum_id').notNull().references(() => curriculums.id, { onDelete: 'cascade' }),
    eventId: text('event_id').notNull().references(() => moduleEvents.id, { onDelete: 'cascade' }),
    allocatedDuration: integer('allocated_duration').notNull().default(0),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
    pk: primaryKey({ columns: [ t.curriculumId, t.eventId ] })
}));

/**
 * Maps modules to specific days within specific weeks.
 * Supports variable-sized weeks where dayIndex is relative to the weekIndex.
 */
export const curriculumModuleDayAssignments = pgTable('cMDA', {
    curriculumId: text('curriculum_id')
        .notNull()
        .references(() => curriculums.id, { onDelete: 'cascade' }),
    moduleId: text('module_id')
        .notNull()
        .references(() => modules.id, { onDelete: 'cascade' }),

    // 0-based index of the week within the curriculum
    weekIndex: integer('week_index').notNull(),

    // 0-based index of the day within the specific week
    dayIndex: integer('day_index').notNull(),

    // Internal sort order for multiple modules assigned to the same day
    sortOrder: real('sort_order').notNull().default(0),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
    // Primary key ensures a module is unique per curriculum/week/day slot
    pk: primaryKey({ columns: [ t.curriculumId, t.moduleId ] })
}));

export const curriculumSyllabuses = pgTable('cS', {
    curriculumId: text('curriculum_id').notNull().references(() => curriculums.id, { onDelete: 'cascade' }),
    syllabusId: text('syllabus_id').notNull().references(() => syllabuses.id, { onDelete: 'cascade' }),
}, (t) => ({
    pk: primaryKey({ columns: [ t.curriculumId, t.syllabusId ] })
}));

export const syllabusModules = pgTable('sM', {
    syllabusId: text('syllabus_id').notNull().references(() => syllabuses.id, { onDelete: 'cascade' }),
    moduleId: text('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
}, (t) => ({
    pk: primaryKey({ columns: [ t.syllabusId, t.moduleId ] })
}));

export const moduleToEvents = pgTable('mE', {
    moduleId: text('module_id').notNull().references(() => modules.id, { onDelete: 'cascade' }),
    eventId: text('event_id').notNull().references(() => moduleEvents.id, { onDelete: 'cascade' }),
}, (t) => ({
    pk: primaryKey({ columns: [ t.moduleId, t.eventId ] })
}));

export const curriculumsRelations = relations(curriculums, ({ many }) => ({
    cS: many(curriculumSyllabuses),
    cEC: many(curriculumEventConfigurations), // eventConfigs
    cMDA: many(curriculumModuleDayAssignments),
}));

export const syllabusesRelations = relations(syllabuses, ({ many }) => ({
    cS: many(curriculumSyllabuses),
    sM: many(syllabusModules),
}));

export const modulesRelations = relations(modules, ({ many }) => ({
    sM: many(syllabusModules),
    mE: many(moduleToEvents),
}));

export const moduleEventsRelations = relations(moduleEvents, ({ many }) => ({
    mE: many(moduleToEvents),
    cEC: many(curriculumEventConfigurations), // curriculumConfigs
}));


export const curriculumSyllabusesRelations = relations(curriculumSyllabuses, ({ one }) => ({
    curriculum: one(curriculums, {
        fields: [ curriculumSyllabuses.curriculumId ],
        references: [ curriculums.id ],
    }),
    syllabus: one(syllabuses, {
        fields: [ curriculumSyllabuses.syllabusId ],
        references: [ syllabuses.id ],
    }),
}));

export const syllabusModulesRelations = relations(syllabusModules, ({ one }) => ({
    syllabus: one(syllabuses, {
        fields: [ syllabusModules.syllabusId ],
        references: [ syllabuses.id ],
    }),
    module: one(modules, {
        fields: [ syllabusModules.moduleId ],
        references: [ modules.id ],
    }),
}));

export const moduleToEventsRelations = relations(moduleToEvents, ({ one }) => ({
    module: one(modules, {
        fields: [ moduleToEvents.moduleId ],
        references: [ modules.id ],
    }),
    event: one(moduleEvents, {
        fields: [ moduleToEvents.eventId ],
        references: [ moduleEvents.id ],
    }),
}));

export const curriculumEventConfigurationsRelations = relations(curriculumEventConfigurations, ({ one }) => ({
    curriculum: one(curriculums, {
        fields: [ curriculumEventConfigurations.curriculumId ],
        references: [ curriculums.id ],
    }),
    event: one(moduleEvents, {
        fields: [ curriculumEventConfigurations.eventId ],
        references: [ moduleEvents.id ],
    }),
}));

export const curriculumModuleDayAssignmentsRelations = relations(curriculumModuleDayAssignments, ({ one }) => ({
    curriculum: one(curriculums, {
        fields: [ curriculumModuleDayAssignments.curriculumId ],
        references: [ curriculums.id ],
    }),
    module: one(modules, {
        fields: [ curriculumModuleDayAssignments.moduleId ],
        references: [ modules.id ],
    }),
}));
