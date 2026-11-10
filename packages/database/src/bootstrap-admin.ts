import dotenv from 'dotenv';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { slugify } from '@porteria/shared';
import { createDb } from './connection.js';
import { organizations } from './schema/organizations.js';
import { communities } from './schema/communities.js';
import { users } from './schema/users.js';
import { people } from './schema/people.js';
import { accounts } from './schema/accounts.js';
import { memberships } from './schema/memberships.js';
import { accessPoints } from './schema/access-points.js';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const db = createDb();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

async function main() {
  const organizationName = required('BOOTSTRAP_ORG_NAME');
  const communityName = required('BOOTSTRAP_COMMUNITY_NAME');
  const adminEmail = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
  const adminPassword = required('BOOTSTRAP_ADMIN_PASSWORD');
  const adminName = process.env.BOOTSTRAP_ADMIN_NAME?.trim() || 'Administrador';
  const communityAddress = process.env.BOOTSTRAP_COMMUNITY_ADDRESS?.trim() || 'Sin dirección';
  const communityTimezone = process.env.BOOTSTRAP_COMMUNITY_TIMEZONE?.trim() || 'America/Bogota';
  const accessPointName = process.env.BOOTSTRAP_ACCESS_POINT_NAME?.trim() || 'Portón Principal';
  const forcePassword = process.env.BOOTSTRAP_FORCE_PASSWORD === 'true';
  const isPlatformAdmin = process.env.BOOTSTRAP_PLATFORM_ADMIN === 'true';

  if (adminPassword.length < 12) {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must be at least 12 characters');
  }
  if (adminPassword === 'porteria123') {
    throw new Error('BOOTSTRAP_ADMIN_PASSWORD must not be the demo password');
  }

  const orgSlug = process.env.BOOTSTRAP_ORG_SLUG?.trim() || slugify(organizationName);
  const communitySlug = process.env.BOOTSTRAP_COMMUNITY_SLUG?.trim() || slugify(communityName);

  let [organization] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);
  if (!organization) {
    [organization] = await db
      .insert(organizations)
      .values({ name: organizationName, slug: orgSlug })
      .returning();
    console.log(`Organization created: ${organization.name} (${organization.id})`);
  } else {
    console.log(`Organization exists: ${organization.name} (${organization.id})`);
  }

  let [community] = await db
    .select()
    .from(communities)
    .where(eq(communities.slug, communitySlug))
    .limit(1);
  if (!community) {
    [community] = await db
      .insert(communities)
      .values({
        name: communityName,
        slug: communitySlug,
        address: communityAddress,
        timezone: communityTimezone,
        organizationId: organization.id,
      })
      .returning();
    console.log(`Community created: ${community.name} (${community.id})`);
  } else {
    if (community.organizationId !== organization.id) {
      throw new Error(
        `Community slug "${communitySlug}" already belongs to another organization. Set BOOTSTRAP_COMMUNITY_SLUG to a unique value.`,
      );
    }
    console.log(`Community exists: ${community.name} (${community.id})`);
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const [existingAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.email, adminEmail))
    .limit(1);

  let userId: string;
  let personId: string;

  if (existingAccount) {
    const [existingUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, adminEmail))
      .limit(1);
    if (!existingUser) {
      throw new Error(
        `Account ${adminEmail} exists but has no matching row in users. Resolve it manually before bootstrapping.`,
      );
    }
    const [existingPerson] = await db
      .select()
      .from(people)
      .where(eq(people.id, existingAccount.personId))
      .limit(1);
    if (!existingPerson) {
      throw new Error(
        `Account ${adminEmail} exists but its person record is missing. Resolve it manually before bootstrapping.`,
      );
    }
    userId = existingUser.id;
    personId = existingPerson.id;

    if (forcePassword || isPlatformAdmin) {
      await db.transaction(async (tx) => {
        if (forcePassword) {
          await tx.update(users).set({ passwordHash }).where(eq(users.id, userId));
          await tx
            .update(accounts)
            .set({ passwordHash })
            .where(eq(accounts.id, existingAccount.id));
        }
        if (isPlatformAdmin) {
          await tx.update(users).set({ isPlatformAdmin: true }).where(eq(users.id, userId));
          await tx
            .update(accounts)
            .set({ isPlatformAdmin: true })
            .where(eq(accounts.id, existingAccount.id));
        }
      });
      if (forcePassword) {
        console.log('Admin password rotated (BOOTSTRAP_FORCE_PASSWORD=true).');
      }
      if (isPlatformAdmin) {
        console.log('Admin promoted to platform admin.');
      }
    } else {
      console.log('Admin account exists; password and platform flag left unchanged.');
    }
  } else {
    const [firstName, ...lastNameParts] = adminName.split(/\s+/);
    const created = await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: adminEmail,
          name: adminName,
          passwordHash,
          isPlatformAdmin,
        })
        .returning();
      const [person] = await tx
        .insert(people)
        .values({
          firstName: firstName || adminName,
          lastName: lastNameParts.join(' '),
          contactEmail: adminEmail,
          status: 'active',
        })
        .returning();
      await tx.insert(accounts).values({
        personId: person.id,
        email: adminEmail,
        passwordHash,
        active: true,
        isPlatformAdmin,
      });
      return { userId: user.id, personId: person.id };
    });
    userId = created.userId;
    personId = created.personId;
    console.log(`Admin created: ${adminEmail} (user ${userId})`);
  }

  await db
    .insert(memberships)
    .values({
      userId,
      personId,
      organizationId: organization.id,
      communityId: community.id,
      role: 'org_admin',
      status: 'active',
    })
    .onConflictDoNothing();
  console.log(`Membership ensured: org_admin in ${community.name}`);

  const [existingAccessPoint] = await db
    .select()
    .from(accessPoints)
    .where(and(eq(accessPoints.communityId, community.id), eq(accessPoints.name, accessPointName)))
    .limit(1);
  if (!existingAccessPoint) {
    const [createdAccessPoint] = await db
      .insert(accessPoints)
      .values({
        communityId: community.id,
        name: accessPointName,
        type: 'gate',
        direction: 'both',
        failPolicy: 'closed',
        active: true,
      })
      .returning();
    console.log(`Access point created: ${createdAccessPoint.name} (${createdAccessPoint.id})`);
  } else {
    console.log(`Access point exists: ${existingAccessPoint.name}`);
  }

  console.log('Bootstrap complete. Sign in with the bootstrap admin email and password.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Bootstrap failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  });
