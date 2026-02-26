-- Migration 027: Backfill Audit Log Enhanced Columns
-- Description: Populates actor_username, actor_role, action_category, severity, search_text for existing rows
-- Created: 2026-02-26
-- Impact: Updates existing rows in batches of 5000 to avoid long locks and dead tuple bloat
-- Risk Level: MEDIUM - Updates existing data but in small batches; fully idempotent

-- Backfill actor_username and actor_role from users table
-- NULL actor_id (deleted users per migration 021) will remain NULL
DO $$
DECLARE
  batch_size INTEGER := 5000;
  updated_count INTEGER;
  total_updated INTEGER := 0;
BEGIN
  LOOP
    UPDATE audit_logs al
    SET
      actor_username = u.username,
      actor_role = u.role
    FROM users u
    WHERE al.actor_id = u.id
      AND al.actor_username IS NULL
      AND al.id IN (
        SELECT id FROM audit_logs
        WHERE actor_username IS NULL AND actor_id IS NOT NULL
        LIMIT batch_size
      );

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    total_updated := total_updated + updated_count;

    EXIT WHEN updated_count = 0;

    RAISE NOTICE 'Backfilled actor info: % rows (% total)', updated_count, total_updated;
    PERFORM pg_sleep(0.1);
  END LOOP;

  RAISE NOTICE 'Actor info backfill complete: % total rows updated', total_updated;
END $$;

-- Backfill action_category and severity based on action type
UPDATE audit_logs
SET
  action_category = CASE
    WHEN action = 'USER_LOGIN' THEN 'authentication'
    WHEN action IN ('USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'PASSWORD_RESET',
                    'ASSIGN_USER_TO_DEPARTMENT', 'REMOVE_USER_FROM_DEPARTMENT') THEN 'user_management'
    WHEN action IN ('TICKET_UPDATED', 'CREATE_ADMIN_TICKET', 'CREATE_DEPARTMENT_TICKET') THEN 'ticket_management'
    WHEN action IN ('CREATE_DEPARTMENT', 'UPDATE_DEPARTMENT', 'DEACTIVATE_DEPARTMENT',
                    'REACTIVATE_DEPARTMENT') THEN 'department_management'
    WHEN action IN ('FLOOR_CREATED', 'FLOOR_UPDATED', 'FLOOR_DEACTIVATED',
                    'FLOOR_REACTIVATED') THEN 'floor_management'
    ELSE 'system'
  END,
  severity = CASE
    WHEN action IN ('USER_DELETED', 'DEACTIVATE_DEPARTMENT', 'FLOOR_DEACTIVATED') THEN 'critical'
    WHEN action IN ('PASSWORD_RESET', 'USER_UPDATED', 'DEACTIVATE_DEPARTMENT') THEN 'warning'
    ELSE 'info'
  END
WHERE action_category IS NULL;

-- Backfill search_text from action + target_type + target_id + details summary
UPDATE audit_logs
SET search_text = CONCAT_WS(' ',
  REPLACE(LOWER(action), '_', ' '),
  LOWER(COALESCE(target_type, '')),
  CASE WHEN target_id IS NOT NULL THEN CONCAT('#', target_id) ELSE '' END,
  LOWER(COALESCE(actor_username, '')),
  LOWER(COALESCE(ip_address, '')),
  CASE
    WHEN details IS NOT NULL THEN LEFT(LOWER(details::text), 200)
    ELSE ''
  END
)
WHERE search_text IS NULL;

-- Migration verification
DO $$
DECLARE
  null_category_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO null_category_count
  FROM audit_logs
  WHERE action_category IS NULL;

  IF null_category_count > 0 THEN
    RAISE WARNING 'Migration 027: % rows still have NULL action_category', null_category_count;
  ELSE
    RAISE NOTICE 'Migration 027 completed successfully: All audit log rows backfilled';
  END IF;
END $$;
