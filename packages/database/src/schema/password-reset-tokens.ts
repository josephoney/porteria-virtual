import { index, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

import { accounts } from './accounts';

/**
 * Enlaces de recuperación de contraseña.
 *
 * El token se guarda hasheado: quien lea la base no puede usarlo. Es de un solo
 * uso (`usedAt`) y vence: un enlace olvidado en un correo no queda vivo para
 * siempre.
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    tokenHash: varchar('token_hash', { length: 255 }).notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    requestedIp: varchar('requested_ip', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('password_reset_tokens_account_idx').on(table.accountId, table.createdAt)],
);

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
