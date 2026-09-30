-- Read-only. Counts saved PO glass lines whose stored amount equals qty x unit cost
-- while sqft > 0, i.e. lines priced by piece instead of by sqft before the PO
-- amount fix. Changes nothing.
--   sudo -u postgres psql essarglass -f scripts/po_repriced_lines.sql
SELECT
  count(*)                                              AS glass_lines_with_sqft,
  count(*) FILTER (WHERE repriced)                      AS repriced_lines,
  count(DISTINCT po_id) FILTER (WHERE repriced)         AS repriced_pos,
  round(sum(sqft * price - amount) FILTER (WHERE repriced), 2) AS repriced_shortfall
FROM (
  SELECT po.id AS po_id,
         coalesce(nullif(l->>'sqft', '')::numeric, 0)       AS sqft,
         coalesce(nullif(l->>'quantity', '')::numeric, 1)   AS qty,
         coalesce(nullif(l->>'unit_price', '')::numeric, 0) AS price,
         coalesce(nullif(l->>'subtotal', '')::numeric, 0)   AS amount,
         abs(coalesce(nullif(l->>'subtotal', '')::numeric, 0)
             - coalesce(nullif(l->>'quantity', '')::numeric, 1) * coalesce(nullif(l->>'unit_price', '')::numeric, 0)) <= 0.01
         AND abs(coalesce(nullif(l->>'quantity', '')::numeric, 1) - coalesce(nullif(l->>'sqft', '')::numeric, 0)) > 0.0001
         AND coalesce(nullif(l->>'unit_price', '')::numeric, 0) > 0 AS repriced
  FROM purchase_orders po
  CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(po.lines::jsonb) = 'array' THEN po.lines::jsonb ELSE '[]'::jsonb END) l
  WHERE po.is_active
    AND coalesce(l->>'item_type', 'glass') = 'glass'
) x
WHERE sqft > 0;
