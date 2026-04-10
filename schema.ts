import { pgTable, text, integer, jsonb, primaryKey } from "drizzle-orm/pg-core";

// --- Entities ---
export const curriculums = pgTable('curriculums', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
});

export const syllabuses = pgTable('syllabuses', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
});

// ... similar tables for modules, events, weeks, days ...

// --- Junction Tables (Many-to-Many) ---
export const curriculumSyllabuses = pgTable('curriculum_syllabuses', {
  curriculumId: text('curriculum_id').references(() => curriculums.id),
  syllabusId: text('syllabus_id').references(() => syllabuses.id),
}, (t) => ({
  pk: primaryKey({ columns: [t.curriculumId, t.syllabusId] })
}));