export interface Migration {
  /** Sortable unique id, e.g. "0002_notifications_recipient_fk". Never rename once applied. */
  id: string;
  /** Plain SQL, run in one transaction. Never edit once applied: add a new migration. */
  sql: string;
}
