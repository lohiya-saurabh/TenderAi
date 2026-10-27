/**
 * 0002 — notifications.recipient_user_id references users(id).
 *
 * NULL keeps meaning "every user in the organization". Rows addressed to a user that
 * no longer exists are unreadable by anyone, so they are removed before the
 * constraint is added.
 */
import type { Migration } from './types.js';

export const migration0002NotificationsRecipientFk: Migration = {
  id: '0002_notifications_recipient_fk',
  sql: `
    DELETE FROM notifications n
    WHERE n.recipient_user_id IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = n.recipient_user_id);

    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_notifications_recipient') THEN
        ALTER TABLE notifications ADD CONSTRAINT fk_notifications_recipient
          FOREIGN KEY (recipient_user_id) REFERENCES users(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `,
};
