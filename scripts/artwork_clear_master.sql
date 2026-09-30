-- Clears the Artwork Master (the artwork library) for EVERY company.
-- Artwork already attached to workshop orders / quotations is not touched.
-- Take a backup first. Run scripts/artwork_report.sql before and after.
--   sudo -u postgres psql essarglass -f scripts/artwork_clear_master.sql
--
-- Sets the list to [] rather than deleting the row, so an old browser copy can
-- never be re-uploaded in its place.
BEGIN;
UPDATE company_settings SET value = '[]' WHERE key = 'artwork_master';
SELECT company_id, value AS artwork_master_now FROM company_settings WHERE key = 'artwork_master' ORDER BY company_id;
COMMIT;
