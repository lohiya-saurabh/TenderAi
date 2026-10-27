/**
 * Ordered schema migrations. To change the schema:
 *   1. edit the Drizzle schema in ../schema/*,
 *   2. add a new NNNN_description.ts here with the matching SQL and append it below.
 * Never edit or reorder a migration that has been applied anywhere.
 */
import { migration0001Baseline } from './0001_baseline.js';
import { migration0002NotificationsRecipientFk } from './0002_notifications_recipient_fk.js';
import type { Migration } from './types.js';

export type { Migration } from './types.js';

export const MIGRATIONS: readonly Migration[] = [
  migration0001Baseline,
  migration0002NotificationsRecipientFk,
];
