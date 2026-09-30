-- Read-only. What artwork exists, before clearing the Artwork Master.
--   sudo -u postgres psql essarglass -f scripts/artwork_report.sql

-- 1. Artwork Master (the library), per company
SELECT s.company_id, c.name AS company,
       CASE WHEN s.value ~ '^\s*\[' THEN json_array_length(s.value::json) END AS artworks,
       pg_size_pretty(length(coalesce(s.value, ''))::bigint) AS size
FROM company_settings s
LEFT JOIN companies c ON c.id = s.company_id
WHERE s.key = 'artwork_master'
ORDER BY s.company_id;

-- 2. Artwork already attached to documents (NOT touched by artwork_clear_master.sql)
SELECT 'workshop order lines' AS where_used, count(*) AS documents
  FROM workshop_orders WHERE lines::text LIKE '%"artwork_file_data": "data:%'
UNION ALL
SELECT 'workshop order panel maps', count(*)
  FROM workshop_orders WHERE coalesce(artwork_image, '') <> '' OR coalesce(artwork_panels::text, 'null') NOT IN ('null', '[]')
UNION ALL
SELECT 'quotation glass groups', count(*)
  FROM quotations WHERE groups::text LIKE '%"artwork_file_data": "data:%'
UNION ALL
SELECT 'sales order glass groups', count(*)
  FROM sales_orders WHERE groups::text LIKE '%"artwork_file_data": "data:%';
