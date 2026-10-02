-- Convert week splits (#768) into one cMDA mapping per week before the column
-- goes. A valid split: event flagged split_across_weeks, >= 2 parts, parts sum
-- to the event's minimum_duration. Part i (i >= 2, > 0 minutes) lands on the
-- day at the same position (clamped to that week's day count) in the
-- curriculum's (i-1)-th following week. Weeks order by w.number, days by
-- d.day_index (the c2w / w2d junctions carry no ordering column).
-- Parts past the curriculum's last week are dropped.
WITH src AS (
    SELECT m.curriculum_id, m.module_id, m.event_id, m.day_id, m.s,
           m.week_split_minutes AS parts
    FROM "cMDA" m
    JOIN "e" ev ON ev.id = m.event_id
    WHERE ev.split_across_weeks
      AND cardinality(m.week_split_minutes) >= 2
      AND (SELECT sum(p) FROM unnest(m.week_split_minutes) AS p) = ev.minimum_duration
),
weeks AS (
    SELECT cw.c_id, cw.w_id,
           row_number() OVER (PARTITION BY cw.c_id ORDER BY wk.number, wk.id) AS wn
    FROM "c2w" cw
    JOIN "w" wk ON wk.id = cw.w_id
),
days AS (
    SELECT wd.w_id, wd.d_id,
           row_number() OVER (PARTITION BY wd.w_id ORDER BY dy.day_index, dy.id) AS dn,
           count(*) OVER (PARTITION BY wd.w_id) AS cnt
    FROM "w2d" wd
    JOIN "d" dy ON dy.id = wd.d_id
),
pos AS (
    SELECT src.*, wk.wn, dy.dn
    FROM src
    JOIN weeks wk ON wk.c_id = src.curriculum_id
    JOIN days dy ON dy.w_id = wk.w_id AND dy.d_id = src.day_id
)
INSERT INTO "cMDA" (id, curriculum_id, module_id, event_id, day_id, s, allotted_minutes)
SELECT gen_random_uuid()::text, pos.curriculum_id, pos.module_id, pos.event_id,
       td.d_id, pos.s, part.v
FROM pos
CROSS JOIN LATERAL unnest(pos.parts) WITH ORDINALITY AS part(v, i)
JOIN weeks tw ON tw.c_id = pos.curriculum_id AND tw.wn = pos.wn + part.i - 1
JOIN days td ON td.w_id = tw.w_id AND td.dn = LEAST(pos.dn, td.cnt)
WHERE part.i >= 2 AND part.v > 0
ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE "cMDA" m
SET allotted_minutes = m.week_split_minutes[1]
FROM "e" ev
WHERE ev.id = m.event_id
  AND ev.split_across_weeks
  AND cardinality(m.week_split_minutes) >= 2
  AND (SELECT sum(p) FROM unnest(m.week_split_minutes) AS p) = ev.minimum_duration;--> statement-breakpoint
DROP TABLE "cEC" CASCADE;--> statement-breakpoint
ALTER TABLE "cMDA" DROP COLUMN "week_split_minutes";
