import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { eq, sql } from 'drizzle-orm';
import { createDb } from '@porteria/database';
import {
  accounts,
  communities,
  guardRounds,
  organizations,
  people,
} from '@porteria/database/schema';

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

  it('has no user references in rounds or residents', async () => {
    const columns = await db.execute<{ table_name: string; column_name: string }>(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and (table_name, column_name) in (
          ('guard_rounds', 'guard_id'),
          ('location_residents', 'user_id')
        )
    `);
    assert.equal(columns.rows.length, 0);

    const notNull = await db.execute<{ table_name: string; is_nullable: string }>(sql`
      select table_name, is_nullable
      from information_schema.columns
      where table_schema = 'public'
        and (table_name, column_name) in (
          ('guard_rounds', 'guard_person_id'),
          ('location_residents', 'person_id')
        )
    `);
    assert.equal(notNull.rows.length, 2);
    assert.equal(
      notNull.rows.every((row) => row.is_nullable === 'NO'),
      true,
    );

    const foreignKeys = await db.execute<{ conname: string; confdeltype: string }>(sql`
      select conname, confdeltype
      from pg_constraint
      where contype = 'f'
        and conrelid in ('guard_rounds'::regclass, 'location_residents'::regclass)
        and confrelid = 'people'::regclass
    `);
    assert.deepEqual(foreignKeys.rows.map((row) => row.conname).sort(), [
      'guard_rounds_guard_person_id_people_id_fk',
      'location_residents_person_id_people_id_fk',
    ]);
    assert.equal(
      foreignKeys.rows.every((row) => row.confdeltype === 'c'),
      true,
    );
  });

  it('has retired the legacy users table and its columns', async () => {
    const tables = await db.execute<{ table_name: string }>(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name = 'users'
    `);
    assert.equal(tables.rows.length, 0);

    const columns = await db.execute<{ table_name: string; column_name: string }>(sql`
      select table_name, column_name
      from information_schema.columns
      where table_schema = 'public'
        and (table_name, column_name) in (
          ('access_codes', 'created_by'),
          ('visitors', 'created_by'),
          ('memberships', 'user_id')
        )
    `);
    assert.equal(columns.rows.length, 0);
  });

  it('creates and lists a guard round for a person without an account', async () => {
    const suffix = randomUUID().slice(0, 8);
    const [organization] = await db
      .insert(organizations)
      .values({ name: `Rounds Org ${suffix}`, slug: `rounds-org-${suffix}` })
      .returning();
    const [community] = await db
      .insert(communities)
      .values({
        organizationId: organization.id,
        name: `Rounds Community ${suffix}`,
        slug: `rounds-community-${suffix}`,
        address: 'Test address',
        timezone: 'UTC',
      })
      .returning();
    const [guardPerson] = await db
      .insert(people)
      .values({ firstName: 'Guardia', lastName: 'Sin Cuenta', status: 'active' })
      .returning();

    try {
      const [round] = await db
        .insert(guardRounds)
        .values({
          guardPersonId: guardPerson.id,
          communityId: community.id,
          name: 'Ronda sin cuenta',
        })
        .returning();
      assert.equal(round.guardPersonId, guardPerson.id);

      const [listed] = await db
        .select({
          id: guardRounds.id,
          guardPersonId: guardRounds.guardPersonId,
          guardFirstName: people.firstName,
        })
        .from(guardRounds)
        .innerJoin(people, eq(people.id, guardRounds.guardPersonId))
        .where(eq(guardRounds.id, round.id));
      assert.equal(listed.guardPersonId, guardPerson.id);
      assert.equal(listed.guardFirstName, 'Guardia');

      const guardAccounts = await db
        .select({ id: accounts.id })
        .from(accounts)
        .where(eq(accounts.personId, guardPerson.id));
      assert.equal(guardAccounts.length, 0);
    } finally {
      await db.delete(organizations).where(eq(organizations.id, organization.id));
      await db.delete(people).where(eq(people.id, guardPerson.id));
    }
  });
});

describe('schema migration 0040', () => {
  it('creates the invitation_units bridge table', async () => {
    const columns = await db.execute<{ column_name: string }>(sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public' and table_name = 'invitation_units'
    `);
    const names = new Set(columns.rows.map((row) => row.column_name));
    for (const expected of ['invitation_id', 'location_unit_id', 'created_at']) {
      assert.equal(names.has(expected), true, expected);
    }

    const constraints = await db.execute<{ conname: string }>(sql`
      select conname
      from pg_constraint
      where conrelid = 'invitation_units'::regclass
    `);
    const constraintNames = new Set(constraints.rows.map((row) => row.conname));
    for (const expected of [
      'invitation_units_invitation_id_location_unit_id_pk',
      'invitation_units_invitation_id_fk',
      'invitation_units_location_unit_id_fk',
    ]) {
      assert.equal(constraintNames.has(expected), true, expected);
    }

    const indexes = await db.execute<{ indexname: string }>(sql`
      select indexname
      from pg_indexes
      where schemaname = 'public' and tablename = 'invitation_units'
    `);
    const indexNames = new Set(indexes.rows.map((row) => row.indexname));
    assert.equal(indexNames.has('invitation_units_location_unit_idx'), true);
  });

  it('backfills every invitation with a primary location unit', async () => {
    const result = await db.execute<{ count: number }>(sql`
      select count(*)::int as count
      from invitations i
      where i.location_unit_id is not null
        and not exists (
          select 1
          from invitation_units u
          where u.invitation_id = i.id
            and u.location_unit_id = i.location_unit_id
        )
    `);
    assert.equal(result.rows[0]?.count, 0);
  });
});
