import { index, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { accounts } from './accounts';
import { bitacoraEntries } from './bitacora-entries';
import { people } from './people';

export const bitacoraComments = pgTable(
  'bitacora_comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    entryId: uuid('entry_id')
      .notNull()
      .references(() => bitacoraEntries.id, { onDelete: 'cascade' }),
    authorPersonId: uuid('author_person_id').references(() => people.id, {
      onDelete: 'set null',
    }),
    authorAccountId: uuid('author_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    body: text('body').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    entryCreatedIdx: index('bitacora_comment_entry_created_idx').on(
      table.entryId,
      table.createdAt,
    ),
  }),
);
