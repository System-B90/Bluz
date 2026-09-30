UPDATE "m2e" SET "sort_order" = ranked."rn"
FROM (
  SELECT m."module_id", m."event_id",
    (row_number() OVER (PARTITION BY m."module_id" ORDER BY m."sort_order", e."ca", m."event_id") - 1)::integer AS "rn"
  FROM "m2e" m JOIN "e" e ON e."id" = m."event_id"
) AS ranked
WHERE "m2e"."module_id" = ranked."module_id" AND "m2e"."event_id" = ranked."event_id"
  AND "m2e"."sort_order" <> ranked."rn";
