import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sql } from 'drizzle-orm';
import { createDb } from '@porteria/database';

const db = createDb();

describe('schema migration 0008', () => {
  it('has people, accounts and assets tables', async () => {
    const result = await db.execute<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in ('people', 'accounts', 'assets')
    `);
    const tables = result.rows.map((row) => row.table_name).sort();
    assert.deepEqual(tables, ['accounts', 'assets', 'people']);
  });

  it('has person/account references for external audit and operations', async () => {
    const result = await db.execute<{ table_name: string; column_name: string }>(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and (table_name, column_name) in (
          ('visitors', 'created_by_person_id'),
          ('calls', 'operator_person_id'),
          ('events', 'actor_person_id'),
          ('access_codes', 'created_by_person_id'),
          ('guard_rounds', 'guard_person_id'),
          ('refresh_tokens', 'account_id')
        )
    `);
    assert.equal(result.rows.length, 6);
  });

  it('has hierarchy indexes and check constraints', async () => {
    const indexes = await db.execute<{ indexname: string }>(sql`
      select indexname
      from pg_indexes
      where schemaname = 'public'
        and tablename = 'location_units'
        and indexname in (
          'location_units_community_idx',
          'location_units_structure_idx',
          'location_units_parent_idx',
          'location_units_structure_parent_code_idx'
        )
    `);
    assert.equal(indexes.rows.length, 4);

    const constraints = await db.execute<{ conname: string }>(sql`
      select conname
      from pg_constraint
      where conrelid = 'location_units'::regclass
        and contype = 'c'
    `);
    const names = new Set(constraints.rows.map((row) => row.conname));
    for (const expected of [
      'location_units_level_position_check',
      'location_units_root_check',
      'location_units_code_check',
      'location_units_other_label_check',
    ]) {
      assert.equal(names.has(expected), true, expected);
    }
  });

  it('has profile, person and location-unit columns', async () => {
    const result = await db.execute<{ table_name: string; column_name: string }>(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and (
          (table_name = 'organizations' and column_name in
            ('nit', 'phone', 'address', 'legal_representative_person_id',
             'logo_asset_id', 'welcome_message', 'profile_completed_at'))
          or (table_name = 'communities' and column_name in
            ('phone', 'type', 'type_label', 'latitude', 'longitude',
             'logo_asset_id', 'welcome_message'))
          or (table_name = 'memberships' and column_name in
            ('person_id', 'location_unit_id'))
          or (table_name = 'invitations' and column_name in ('location_unit_id'))
        )
    `);

    const columns = new Set(result.rows.map((row) => `${row.table_name}.${row.column_name}`));
    for (const expected of [
      'organizations.nit',
      'organizations.legal_representative_person_id',
      'communities.type',
      'communities.latitude',
      'memberships.person_id',
      'memberships.location_unit_id',
      'invitations.location_unit_id',
    ]) {
      assert.equal(columns.has(expected), true, expected);
    }
  });
});
