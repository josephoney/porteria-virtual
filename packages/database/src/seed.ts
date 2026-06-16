import 'dotenv/config';
import { createDb } from './connection.js';
import { organizations } from './schema/organizations.js';
import { locations } from './schema/locations.js';
import { accessPoints } from './schema/access-points.js';
import { relayOutputs } from './schema/relay-outputs.js';
import { kiosks } from './schema/kiosks.js';
import { users } from './schema/users.js';
import { visitors } from './schema/visitors.js';
import bcrypt from 'bcryptjs';

async function seed() {
  const db = createDb();
  const passwordHash = await bcrypt.hash('porteria123', 10);

  console.log('🌱 Seeding database...');

  // ─── Organization ──────────────────────────────────────────────────
  const [org] = await db
    .insert(organizations)
    .values({ name: 'Edificio Demo' })
    .onConflictDoNothing()
    .returning();

  const orgId = org?.id;
  if (!orgId) {
    console.log('  Organization already exists, skipping...');
    return;
  }

  console.log(`  ✓ Organization: ${org.name}`);

  // ─── Location ──────────────────────────────────────────────────────
  const [location] = await db
    .insert(locations)
    .values({
      name: 'Torre Principal',
      address: 'Av. Siempre Viva 742, Bogotá',
      timezone: 'America/Bogota',
      organizationId: orgId,
    })
    .returning();

  console.log(`  ✓ Location: ${location.name}`);

  // ─── Access Point ──────────────────────────────────────────────────
  const [accessPoint] = await db
    .insert(accessPoints)
    .values({
      name: 'Puerta Principal',
      type: 'door',
      gpioPin: 17,
      locationId: location.id,
    })
    .returning();

  console.log(`  ✓ Access Point: ${accessPoint.name} (GPIO ${accessPoint.gpioPin})`);

  // ─── Kiosk ─────────────────────────────────────────────────────────
  const [kiosk] = await db
    .insert(kiosks)
    .values({
      name: 'Kiosk-01',
      rpiId: 'edificio-01',
      ipAddress: '192.168.1.100',
      status: 'offline',
      accessPointId: accessPoint.id,
    })
    .returning();

  console.log(`  ✓ Kiosk: ${kiosk.name}`);

  // ─── Relay Outputs ───────────────────────────────────────────────────
  const relayData = [
    { relayIndex: 1, gpioPin: 17, label: 'Puerta', mode: 'momentary' as const, durationMs: 5000, accessPointId: accessPoint.id },
    { relayIndex: 2, gpioPin: 18, label: 'Portón', mode: 'momentary' as const, durationMs: 3000, accessPointId: null },
    { relayIndex: 3, gpioPin: 27, label: 'Luz Hall', mode: 'latch' as const, durationMs: null, accessPointId: null },
    { relayIndex: 4, gpioPin: 22, label: 'Alarma', mode: 'momentary' as const, durationMs: 10000, accessPointId: null },
  ];

  for (const r of relayData) {
    await db
      .insert(relayOutputs)
      .values({
        kioskId: kiosk.id,
        relayIndex: r.relayIndex,
        gpioPin: r.gpioPin,
        label: r.label,
        mode: r.mode,
        durationMs: r.durationMs,
        accessPointId: r.accessPointId ?? null,
      })
      .onConflictDoNothing();
    console.log(`  ✓ Relay ${r.relayIndex}: ${r.label} (GPIO ${r.gpioPin}, ${r.mode})`);
  }

  // ─── Users ─────────────────────────────────────────────────────────
  const roles = [
    { email: 'admin@porteria.local', name: 'Admin Principal', role: 'admin' as const },
    { email: 'operador@porteria.local', name: 'Operador Turno Mañana', role: 'operator' as const },
    { email: 'guardia@porteria.local', name: 'Carlos Guardia', role: 'guard' as const, locationId: location.id },
    { email: 'residente@porteria.local', name: 'María Residente', role: 'resident' as const },
  ];

  const createdUsers: Record<string, string> = {};

  for (const userData of roles) {
    const [user] = await db
      .insert(users)
      .values({
        email: userData.email,
        passwordHash,
        name: userData.name,
        role: userData.role,
        organizationId: orgId,
        locationId: userData.locationId ?? null,
        active: true,
      })
      .onConflictDoNothing()
      .returning();

    if (user) {
      createdUsers[userData.role] = user.id;
      console.log(`  ✓ User: ${user.name} (${user.role})`);
    }
  }

  // ─── Visitors ──────────────────────────────────────────────────────
  const [visitor1] = await db
    .insert(visitors)
    .values({
      name: 'Juan García',
      document: '12345678',
      type: 'permanent',
      organizationId: orgId,
      createdBy: createdUsers.resident ?? null,
    })
    .returning();

  console.log(`  ✓ Visitor: ${visitor1.name} (permanent)`);

  const [visitor2] = await db
    .insert(visitors)
    .values({
      name: 'Delivery Express',
      document: '87654321',
      type: 'delivery',
      organizationId: orgId,
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      createdBy: createdUsers.resident ?? null,
    })
    .returning();

  console.log(`  ✓ Visitor: ${visitor2.name} (delivery)`);

  console.log('\n✅ Seed complete!');
  console.log('   Demo credentials:');
  console.log('   admin@porteria.local / porteria123');
  console.log('   operador@porteria.local / porteria123');
  console.log('   guardia@porteria.local / porteria123');
  console.log('   residente@porteria.local / porteria123');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
