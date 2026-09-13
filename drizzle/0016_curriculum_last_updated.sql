-- A curriculum's "last updated" (#673) must move whenever anything inside it
-- changes, not only when its own row is edited. Writes reach its descendants
-- through dozens of routes, the CLI, cut/reload and import, so it is kept in
-- the database: every child table resolves the curricula it belongs to and
-- touches their updated_at.
--
-- Statement-level with transition tables, so a bulk write touches each
-- curriculum once instead of once per row. Deletes are covered through the
-- junction rows they cascade to, whose parents still exist at that point.
CREATE OR REPLACE FUNCTION bluz_touch_curricula() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    ids text[];
BEGIN
    IF TG_TABLE_NAME IN ('c2s', 'cMDA', 'cEC', 'eRE') THEN
        SELECT array_agg(DISTINCT r.curriculum_id) INTO ids FROM changed_rows r;
    ELSIF TG_TABLE_NAME = 'c2w' THEN
        SELECT array_agg(DISTINCT r.c_id) INTO ids FROM changed_rows r;
    ELSIF TG_TABLE_NAME = 's' THEN
        SELECT array_agg(DISTINCT cs.curriculum_id) INTO ids
        FROM changed_rows r JOIN "c2s" cs ON cs.syllabus_id = r.id;
    ELSIF TG_TABLE_NAME = 's2m' THEN
        SELECT array_agg(DISTINCT cs.curriculum_id) INTO ids
        FROM changed_rows r JOIN "c2s" cs ON cs.syllabus_id = r.syllabus_id;
    ELSIF TG_TABLE_NAME = 'm' THEN
        SELECT array_agg(DISTINCT cs.curriculum_id) INTO ids
        FROM changed_rows r
        JOIN "s2m" sm ON sm.module_id = r.id
        JOIN "c2s" cs ON cs.syllabus_id = sm.syllabus_id;
    ELSIF TG_TABLE_NAME = 'm2e' THEN
        SELECT array_agg(DISTINCT cs.curriculum_id) INTO ids
        FROM changed_rows r
        JOIN "s2m" sm ON sm.module_id = r.module_id
        JOIN "c2s" cs ON cs.syllabus_id = sm.syllabus_id;
    ELSIF TG_TABLE_NAME = 'e' THEN
        SELECT array_agg(DISTINCT cs.curriculum_id) INTO ids
        FROM changed_rows r
        JOIN "m2e" me ON me.event_id = r.id
        JOIN "s2m" sm ON sm.module_id = me.module_id
        JOIN "c2s" cs ON cs.syllabus_id = sm.syllabus_id;
    ELSIF TG_TABLE_NAME = 'cntrs' THEN
        SELECT array_agg(DISTINCT cs.curriculum_id) INTO ids
        FROM changed_rows r
        LEFT JOIN "m2e" me
            ON me.event_id IN (r.owner_event_id, r.target_event_id)
        JOIN "s2m" sm
            ON sm.module_id IN (me.module_id, r.owner_module_id, r.target_module_id)
        JOIN "c2s" cs ON cs.syllabus_id = sm.syllabus_id;
    ELSIF TG_TABLE_NAME = 'w' THEN
        SELECT array_agg(DISTINCT cw.c_id) INTO ids
        FROM changed_rows r JOIN "c2w" cw ON cw.w_id = r.id;
    ELSIF TG_TABLE_NAME = 'w2d' THEN
        SELECT array_agg(DISTINCT cw.c_id) INTO ids
        FROM changed_rows r JOIN "c2w" cw ON cw.w_id = r.w_id;
    ELSIF TG_TABLE_NAME = 'd' THEN
        SELECT array_agg(DISTINCT cw.c_id) INTO ids
        FROM changed_rows r
        JOIN "w2d" wd ON wd.d_id = r.id
        JOIN "c2w" cw ON cw.w_id = wd.w_id;
    END IF;

    -- updated_at is a UTC wall-clock timestamp (Drizzle writes toISOString).
    IF ids IS NOT NULL THEN
        UPDATE "c" SET updated_at = now() AT TIME ZONE 'UTC'
        WHERE id = ANY(ids) AND updated_at < now() AT TIME ZONE 'UTC';
    END IF;
    RETURN NULL;
END;
$$;
--> statement-breakpoint
DO $$
DECLARE
    t text;
BEGIN
    FOREACH t IN ARRAY ARRAY['s', 'm', 'e', 'w', 'd', 'cntrs', 'eRE',
                             'c2s', 's2m', 'm2e', 'c2w', 'w2d', 'cMDA', 'cEC']
    LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch_c_ins', t);
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch_c_upd', t);
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_touch_c_del', t);
        EXECUTE format(
            'CREATE TRIGGER %I AFTER INSERT ON %I REFERENCING NEW TABLE AS changed_rows '
            'FOR EACH STATEMENT EXECUTE FUNCTION bluz_touch_curricula()',
            t || '_touch_c_ins', t);
        EXECUTE format(
            'CREATE TRIGGER %I AFTER UPDATE ON %I REFERENCING NEW TABLE AS changed_rows '
            'FOR EACH STATEMENT EXECUTE FUNCTION bluz_touch_curricula()',
            t || '_touch_c_upd', t);
        EXECUTE format(
            'CREATE TRIGGER %I AFTER DELETE ON %I REFERENCING OLD TABLE AS changed_rows '
            'FOR EACH STATEMENT EXECUTE FUNCTION bluz_touch_curricula()',
            t || '_touch_c_del', t);
    END LOOP;
END;
$$;
