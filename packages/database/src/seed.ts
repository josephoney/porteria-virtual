import 'dotenv/config';
import { eq, and, inArray } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { slugify } from '@porteria/shared';
import { createDb } from './connection.js';
import { organizations } from './schema/organizations.js';
import { communities } from './schema/communities.js';
import { buildings } from './schema/buildings.js';
import { units } from './schema/units.js';
import { users } from './schema/users.js';
import { people } from './schema/people.js';
import { accounts } from './schema/accounts.js';
import { memberships } from './schema/memberships.js';
import { accessPoints } from './schema/access-points.js';
import { kiosks } from './schema/kiosks.js';
import { relayOutputs } from './schema/relay-outputs.js';
import { visitors } from './schema/visitors.js';
import { locationStructures } from './schema/location-structures.js';
import { locationUnits } from './schema/location-units.js';
import { locationResidents } from './schema/location-residents.js';

const db = createDb();
const DEMO_PASSWORD = 'porteria123';
const DEVICE_TOKEN = 'dev-kiosk-token';
const DEVICE_TOKEN_HASH = crypto.createHash('sha256').update(DEVICE_TOKEN).digest('hex');

async function getOrCreateOrganization(name: string) {
  const [existing] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.name, name))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(organizations).values({ name, slug: slugify(name) }).returning();
  return created;
}

async function getOrCreateCommunity(
  organizationId: string,
  data: { name: string; address: string; timezone: string },
) {
  const [existing] = await db
    .select()
    .from(communities)
    .where(
      and(
        eq(communities.organizationId, organizationId),
        eq(communities.name, data.name),
      ),
    )
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(communities)
    .values({ ...data, organizationId, slug: slugify(data.name) })
    .returning();
  return created;
}

async function getOrCreateBuilding(
  communityId: string,
  data: { name: string; code: string; floors: number },
) {
  const [existing] = await db
    .select()
    .from(buildings)
    .where(and(eq(buildings.communityId, communityId), eq(buildings.code, data.code)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(buildings)
    .values({ ...data, communityId })
    .returning();
  return created;
}

async function getOrCreateUnit(
  communityId: string,
  data: {
    buildingId: string | null;
    code: string;
    floor: number;
    type: 'apartment' | 'house' | 'office' | 'parking' | 'storage';
  },
) {
  const [existing] = await db
    .select()
    .from(units)
    .where(and(eq(units.communityId, communityId), eq(units.code, data.code)))
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(units)
    .values({ ...data, communityId })
    .returning();
  return created;
}

async function ensurePersonAccount(
  user: typeof users.$inferSelect,
  passwordHash: string,
) {
  let [person] = await db
    .select()
    .from(people)
    .where(eq(people.contactEmail, user.email))
    .limit(1);

  if (!person) {
    const [firstName, ...lastNameParts] = user.name.split(/\s+/);
    [person] = await db
      .insert(people)
      .values({
        firstName: firstName || user.email,
        lastName: lastNameParts.join(' '),
        contactEmail: user.email,
        status: 'active',
      })
      .returning();
  }

  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, user.email))
    .limit(1);
  if (!account) {
    await db.insert(accounts).values({
      personId: person.id,
      email: user.email,
      passwordHash,
      active: user.active,
      isPlatformAdmin: user.isPlatformAdmin,
    });
  }

  return person;
}

async function getOrCreateUser(
  data: { email: string; name: string; isPlatformAdmin?: boolean },
  passwordHash: string,
) {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, data.email))
    .limit(1);
  if (existing) {
    await ensurePersonAccount(existing, passwordHash);
    return existing;
  }
  const [created] = await db
    .insert(users)
    .values({ ...data, passwordHash, isPlatformAdmin: data.isPlatformAdmin ?? false })
    .returning();
  await ensurePersonAccount(created, passwordHash);
  return created;
}

async function addMembership(data: {
  userId: string;
  organizationId: string;
  communityId?: string | null;
  unitId?: string | null;
  role:
    | 'org_admin'
    | 'community_admin'
    | 'operator'
    | 'guard'
    | 'owner'
    | 'tenant'
    | 'resident'
    | 'staff';
}) {
  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, data.userId))
    .limit(1);
  const [person] = user
    ? await db
        .select({ id: people.id })
        .from(people)
        .where(eq(people.contactEmail, user.email))
        .limit(1)
    : [];

  await db
    .insert(memberships)
    .values({
      userId: data.userId,
      personId: person?.id ?? null,
      organizationId: data.organizationId,
      communityId: data.communityId ?? null,
      unitId: data.unitId ?? null,
      locationUnitId: data.unitId ?? null,
      role: data.role,
      status: 'active',
    })
    .onConflictDoNothing();
}

async function getOrCreateAccessPoint(
  communityId: string,
  data: { name: string; gpioPin: number },
) {
  const [existing] = await db
    .select()
    .from(accessPoints)
    .where(
      and(eq(accessPoints.communityId, communityId), eq(accessPoints.name, data.name)),
    )
    .limit(1);
  if (existing) return existing;
  const [created] = await db
    .insert(accessPoints)
    .values({
      ...data,
      communityId,
      type: 'door',
      failPolicy: 'closed',
      direction: 'both',
    })
    .returning();
  return created;
}

async function getOrCreateKiosk(
  communityId: string,
  data: { name: string; rpiId: string; accessPointId: string },
) {
  const [existing] = await db
    .select()
    .from(kiosks)
    .where(and(eq(kiosks.communityId, communityId), eq(kiosks.rpiId, data.rpiId)))
    .limit(1);
  if (existing) {
    await db
      .update(kiosks)
      .set({ deviceTokenHash: DEVICE_TOKEN_HASH, deviceTokenRotatedAt: new Date() })
      .where(eq(kiosks.id, existing.id));
    return existing;
  }
  const [created] = await db
    .insert(kiosks)
    .values({
      ...data,
      communityId,
      status: 'offline',
      deviceTokenHash: DEVICE_TOKEN_HASH,
      deviceTokenRotatedAt: new Date(),
    })
    .returning();
  return created;
}

async function seedLocationHierarchy(
  communityId: string,
  buildingList: (typeof buildings.$inferSelect)[],
  unitList: (typeof units.$inferSelect)[],
) {
  let [structure] = await db
    .select()
    .from(locationStructures)
    .where(
      and(
        eq(locationStructures.communityId, communityId),
        eq(locationStructures.name, 'Estructura principal'),
      ),
    )
    .limit(1);

  if (!structure) {
    [structure] = await db
      .insert(locationStructures)
      .values({
        communityId,
        name: 'Estructura principal',
        levelCount: 3,
        level1Name: 'Sección',
        level2Name: 'Piso',
        level3Name: 'Unidad',
      })
      .returning();
  }

  for (const building of buildingList) {
    await db
      .insert(locationUnits)
      .values({
        id: building.id,
        communityId,
        structureId: structure.id,
        parentId: null,
        levelPosition: 1,
        name: building.name,
        code: building.code,
        sectionType: 'building',
        metadata: {},
        status: 'active',
      })
      .onConflictDoNothing();
  }

  for (const unit of unitList) {
    if (!unit.buildingId) continue;
    const floorName = `Piso ${unit.floor ?? 0}`;
    let [floorNode] = await db
      .select()
      .from(locationUnits)
      .where(
        and(
          eq(locationUnits.parentId, unit.buildingId),
          eq(locationUnits.levelPosition, 2),
          eq(locationUnits.name, floorName),
        ),
      )
      .limit(1);

    if (!floorNode) {
      [floorNode] = await db
        .insert(locationUnits)
        .values({
          communityId,
          structureId: structure.id,
          parentId: unit.buildingId,
          levelPosition: 2,
          name: floorName,
          metadata: {},
          status: 'active',
        })
        .returning();
    }

    await db
      .insert(locationUnits)
      .values({
        id: unit.id,
        communityId,
        structureId: structure.id,
        parentId: floorNode.id,
        levelPosition: 3,
        name: unit.code,
        code: unit.code,
        metadata: { legacyFloor: unit.floor, legacyType: unit.type },
        status: unit.status,
      })
      .onConflictDoNothing();
  }
}

async function seed() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  console.log('Seeding multi-tenant demo data...');

  const adminOrg = await getOrCreateOrganization('Administradora Demo');
  const independentOrg = await getOrCreateOrganization('Comunidad Independiente Demo');
  console.log(`  Organization: ${adminOrg.name}`);
  console.log(`  Organization: ${independentOrg.name}`);

  const torreNorte = await getOrCreateCommunity(adminOrg.id, {
    name: 'Torre Norte',
    address: 'Av. Siempre Viva 742, Bogotá',
    timezone: 'America/Bogota',
  });
  const losAlamos = await getOrCreateCommunity(independentOrg.id, {
    name: 'Condominio Los Álamos',
    address: 'Calle 10 #5-20, Bogotá',
    timezone: 'America/Bogota',
  });
  console.log(`  Community: ${torreNorte.name}`);
  console.log(`  Community: ${losAlamos.name}`);

  const torreA = await getOrCreateBuilding(torreNorte.id, {
    name: 'Torre A',
    code: 'A',
    floors: 10,
  });
  const torreB = await getOrCreateBuilding(torreNorte.id, {
    name: 'Torre B',
    code: 'B',
    floors: 8,
  });
  const bloque1 = await getOrCreateBuilding(losAlamos.id, {
    name: 'Bloque 1',
    code: 'B1',
    floors: 5,
  });
  console.log(`  Buildings: ${torreA.name}, ${torreB.name}, ${bloque1.name}`);

  const unitA101 = await getOrCreateUnit(torreNorte.id, {
    buildingId: torreA.id,
    code: 'A-101',
    floor: 1,
    type: 'apartment',
  });
  const unitA102 = await getOrCreateUnit(torreNorte.id, {
    buildingId: torreA.id,
    code: 'A-102',
    floor: 1,
    type: 'apartment',
  });
  const unitB201 = await getOrCreateUnit(torreNorte.id, {
    buildingId: torreB.id,
    code: 'B-201',
    floor: 2,
    type: 'apartment',
  });
  const unitA201 = await getOrCreateUnit(losAlamos.id, {
    buildingId: bloque1.id,
    code: '101',
    floor: 1,
    type: 'house',
  });
  console.log(
    `  Units: ${unitA101.code}, ${unitA102.code}, ${unitB201.code}, ${unitA201.code}`,
  );

  await seedLocationHierarchy(
    torreNorte.id,
    [torreA, torreB],
    [unitA101, unitA102, unitB201],
  );
  await seedLocationHierarchy(losAlamos.id, [bloque1], [unitA201]);

  const superAdmin = await getOrCreateUser(
    {
      email: 'superadmin@porteria.local',
      name: 'Super Admin',
      isPlatformAdmin: true,
    },
    passwordHash,
  );
  const orgAdmin = await getOrCreateUser(
    { email: 'admin@porteria.local', name: 'Admin Administradora' },
    passwordHash,
  );
  const orgAdmin2 = await getOrCreateUser(
    { email: 'admin2@porteria.local', name: 'Admin Comunidad Independiente' },
    passwordHash,
  );
  const communityAdmin = await getOrCreateUser(
    { email: 'communityadmin@porteria.local', name: 'Admin Torre Norte' },
    passwordHash,
  );
  const operator = await getOrCreateUser(
    { email: 'operador@porteria.local', name: 'Operador Turno Mañana' },
    passwordHash,
  );
  const guard = await getOrCreateUser(
    { email: 'guardia@porteria.local', name: 'Carlos Guardia' },
    passwordHash,
  );
  const resident = await getOrCreateUser(
    { email: 'residente@porteria.local', name: 'María Residente' },
    passwordHash,
  );
  const resident2 = await getOrCreateUser(
    { email: 'residente2@porteria.local', name: 'Juan Familiar' },
    passwordHash,
  );
  const resident3 = await getOrCreateUser(
    { email: 'residente3@porteria.local', name: 'Ana Los Álamos' },
    passwordHash,
  );
  const multi = await getOrCreateUser(
    { email: 'multi@porteria.local', name: 'Usuario Multi-Comunidad' },
    passwordHash,
  );
  console.log('  Users created');

  // Reset demo memberships so the seed stays deterministic and removes legacy
  // backfilled rows with incomplete scope.
  const demoUserIds = [
    orgAdmin.id,
    orgAdmin2.id,
    communityAdmin.id,
    operator.id,
    guard.id,
    resident.id,
    resident2.id,
    resident3.id,
    multi.id,
  ];
  await db.delete(memberships).where(inArray(memberships.userId, demoUserIds));

  await addMembership({ userId: orgAdmin.id, organizationId: adminOrg.id, role: 'org_admin' });
  await addMembership({ userId: orgAdmin2.id, organizationId: independentOrg.id, role: 'org_admin' });
  await addMembership({
    userId: communityAdmin.id,
    organizationId: adminOrg.id,
    communityId: torreNorte.id,
    role: 'community_admin',
  });
  await addMembership({
    userId: operator.id,
    organizationId: adminOrg.id,
    communityId: torreNorte.id,
    role: 'operator',
  });
  await addMembership({
    userId: guard.id,
    organizationId: adminOrg.id,
    communityId: torreNorte.id,
    role: 'guard',
  });
  await addMembership({
    userId: resident.id,
    organizationId: adminOrg.id,
    communityId: torreNorte.id,
    unitId: unitA101.id,
    role: 'owner',
  });
  await addMembership({
    userId: resident2.id,
    organizationId: adminOrg.id,
    communityId: torreNorte.id,
    unitId: unitA101.id,
    role: 'resident',
  });
  await addMembership({
    userId: resident3.id,
    organizationId: independentOrg.id,
    communityId: losAlamos.id,
    unitId: unitA201.id,
    role: 'tenant',
  });
  await addMembership({
    userId: multi.id,
    organizationId: adminOrg.id,
    communityId: torreNorte.id,
    unitId: unitA102.id,
    role: 'owner',
  });
  await addMembership({
    userId: multi.id,
    organizationId: independentOrg.id,
    communityId: losAlamos.id,
    unitId: unitA201.id,
    role: 'resident',
  });
  console.log(`  Memberships created (superadmin: ${superAdmin.email})`);

  await db
    .insert(locationResidents)
    .values([
      { locationUnitId: unitA101.id, userId: resident.id, relationship: 'owner', validFrom: '2026-01-01', status: 'active' },
      { locationUnitId: unitA101.id, userId: resident2.id, relationship: 'resident', validFrom: '2026-01-01', status: 'active' },
      { locationUnitId: unitA201.id, userId: resident3.id, relationship: 'tenant', validFrom: '2026-01-01', status: 'active' },
      { locationUnitId: unitA102.id, userId: multi.id, relationship: 'owner', validFrom: '2026-01-01', status: 'active' },
      { locationUnitId: unitA201.id, userId: multi.id, relationship: 'resident', validFrom: '2026-01-01', status: 'active' },
    ])
    .onConflictDoNothing();

  const accessPoint = await getOrCreateAccessPoint(torreNorte.id, {
    name: 'Puerta Principal',
    gpioPin: 17,
  });
  const kiosk = await getOrCreateKiosk(torreNorte.id, {
    name: 'Kiosk-01',
    rpiId: 'edificio-01',
    accessPointId: accessPoint.id,
  });
  console.log(`  Access point: ${accessPoint.name} / Kiosk: ${kiosk.name}`);

  const relayData = [
    { relayIndex: 1, gpioPin: 17, label: 'Puerta', mode: 'momentary' as const, durationMs: 5000, accessPointId: accessPoint.id },
    { relayIndex: 2, gpioPin: 18, label: 'Portón', mode: 'momentary' as const, durationMs: 3000, accessPointId: null },
    { relayIndex: 3, gpioPin: 27, label: 'Luz Hall', mode: 'latch' as const, durationMs: null, accessPointId: null },
    { relayIndex: 4, gpioPin: 22, label: 'Alarma', mode: 'momentary' as const, durationMs: 10000, accessPointId: null },
  ];

  for (const relay of relayData) {
    await db
      .insert(relayOutputs)
      .values({ ...relay, kioskId: kiosk.id })
      .onConflictDoNothing();
  }
  console.log('  Relay outputs ready');

  const [existingVisitor] = await db
    .select()
    .from(visitors)
    .where(and(eq(visitors.organizationId, adminOrg.id), eq(visitors.name, 'Juan García')))
    .limit(1);
  if (!existingVisitor) {
    await db.insert(visitors).values({
      name: 'Juan García',
      document: '12345678',
      type: 'permanent',
      organizationId: adminOrg.id,
      createdBy: resident.id,
    });
  }

  console.log(`\n  Kiosk device token (dev): ${DEVICE_TOKEN}`);
  console.log('\nSeed complete!');
  console.log(`   Password for all demo users: ${DEMO_PASSWORD}`);
  console.log('   superadmin@porteria.local  (platform admin)');
  console.log('   admin@porteria.local       (org_admin - Administradora Demo)');
  console.log('   admin2@porteria.local      (org_admin - Comunidad Independiente)');
  console.log('   communityadmin@porteria.local (community_admin - Torre Norte)');
  console.log('   operador@porteria.local    (operator - Torre Norte)');
  console.log('   guardia@porteria.local     (guard - Torre Norte)');
  console.log('   residente@porteria.local   (owner - Torre Norte A-101)');
  console.log('   residente2@porteria.local  (resident - Torre Norte A-101)');
  console.log('   residente3@porteria.local  (tenant - Los Álamos 101)');
  console.log('   multi@porteria.local       (owner Torre Norte + resident Los Álamos)');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
