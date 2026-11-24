import { z } from 'zod';
import {
  BitacoraEntryTypeValues,
  BitacoraResultValues,
  MembershipRoleValues,
  PassStatusValues,
  PassTypeValues,
  ScanActionValues,
  ScanStatusValues,
  type PassStatus,
  type PassType,
} from '@porteria/shared';

export const membershipRoleSchema = z.enum(MembershipRoleValues as [string, ...string[]]);

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  communitySlug: z.string().min(1).optional(),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export const contextSwitchSchema = z.object({
  membershipId: z.string().min(1),
  refreshToken: z.string().min(1).optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(255).optional(),
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().max(120).optional(),
  documentType: z.string().max(30).optional(),
  documentNumber: z.string().max(50).optional(),
  phone: z.string().max(30).optional(),
  role: membershipRoleSchema,
  communityId: z.string().uuid().nullable().optional(),
  communityIds: z.array(z.string().uuid()).optional(),
  unitId: z.string().uuid().nullable().optional(),
  locationUnitId: z.string().uuid().nullable().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  active: z.boolean().optional(),
});

export const createMembershipSchema = z.object({
  userId: z.string().uuid(),
  role: membershipRoleSchema,
  communityId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  locationUnitId: z.string().uuid().nullable().optional(),
  defaultAccessPointId: z.string().uuid().nullable().optional(),
});

export const updateMembershipSchema = z.object({
  role: membershipRoleSchema.optional(),
  status: z.enum(['active', 'inactive']).optional(),
  communityId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  locationUnitId: z.string().uuid().nullable().optional(),
  defaultAccessPointId: z.string().uuid().nullable().optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const callsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['pending', 'active', 'ended', 'missed']).optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  operatorPersonId: z.string().uuid().optional(),
  communityId: z.string().uuid().optional(),
});

export const eventsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  /** Alcance opcional del superadmin: sin él, el Historial es global. */
  organizationId: z.string().uuid().optional(),
  eventType: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  actorId: z.string().uuid().optional(),
  /** Búsqueda por nombre del actor, resuelto desde la persona o la cuenta. */
  actor: z.string().trim().max(120).optional(),
  accessPointId: z.string().uuid().optional(),
  communityId: z.string().uuid().optional(),
});

export const kiosksQuerySchema = z.object({
  status: z.enum(['idle', 'calling', 'in-call', 'offline']).optional(),
  communityId: z.string().uuid().optional(),
});

export const triggerRelaySchema = z.object({
  kioskId: z.string(),
  relayIndex: z.number().int().min(1).max(4).optional(),
  accessPointId: z.string().uuid().optional(),
  requestId: z.string().optional(),
  source: z.enum(['access', 'operator', 'system']).optional(),
});
export const acceptInvitationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  password: z.string().min(8).optional(),
});

export const createInvitationSchema = z.object({
  email: z.string().email(),
  role: membershipRoleSchema,
  organizationId: z.string().uuid().optional(),
  communityId: z.string().uuid().nullable().optional(),
  unitId: z.string().uuid().nullable().optional(),
  locationUnitId: z.string().uuid().nullable().optional(),
  expiresInDays: z.coerce.number().int().min(1).max(30).optional(),
});

export const geographySchema = z.object({
  municipality: z.string().max(120).nullable().optional(),
  department: z.string().max(120).nullable().optional(),
  country: z.string().max(120).nullable().optional(),
});

export const createOrganizationSchema = z.object({
  name: z.string().min(1).max(255),
  slug: z.string().min(3).max(60).optional(),
  /** Días que se conserva la identidad del visitante; la organización los ajusta después. */
  retentionDays: z
    .number()
    .int()
    .refine((value) => value === 30 || value === 60 || value === 90, {
      message: 'Retention must be 30, 60 or 90 days',
    })
    .optional(),
  ...geographySchema.shape,
});

export const updateOrganizationSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  slug: z.string().min(3).max(60).optional(),
  administratorEmail: z.string().email().optional(),
  ...geographySchema.shape,
});

/** The authorization rules the administration sets per community. */
const passRuleShape = {
  passDailyLimitEnabled: z.boolean().optional(),
  passDailyLimit: z.coerce.number().int().min(1).max(500).optional(),
  dynamicQrEnabled: z.boolean().optional(),
};

export const createCommunitySchema = z.object({
  organizationId: z.string().uuid(),
  name: z.string().min(1).max(255),
  address: z.string().min(1).max(500),
  timezone: z.string().min(1).max(50),
  slug: z.string().min(3).max(60).optional(),
  ...passRuleShape,
  ...geographySchema.shape,
});

export const updateCommunitySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().min(1).max(500).optional(),
  timezone: z.string().min(1).max(50).optional(),
  slug: z.string().min(3).max(60).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  ...passRuleShape,
  ...geographySchema.shape,
});

export const createPlatformBuildingSchema = z.object({
  communityId: z.string().uuid(),
  name: z.string().min(1).max(255),
  code: z.string().max(50).nullable().optional(),
  floors: z.coerce.number().int().min(0).nullable().optional(),
});

export const createPlatformUnitSchema = z.object({
  communityId: z.string().uuid(),
  buildingId: z.string().uuid().nullable().optional(),
  code: z.string().min(1).max(50),
  floor: z.coerce.number().int().nullable().optional(),
  type: z.enum(['apartment', 'house', 'office', 'parking', 'storage']),
});

export const inviteOrgAdminSchema = z.object({
  email: z.string().email(),
});

const passTypeSchema = z.enum(PassTypeValues as [PassType, ...PassType[]]);
const passStatusSchema = z.enum(PassStatusValues as [PassStatus, ...PassStatus[]]);

export const MAX_PASS_COMPANIONS = 10;

/**
 * A companion is informational, but the pass is a legal authorization: every
 * field is required and the same document cannot appear twice inside one pass.
 */
export const passCompanionSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(120),
  document: z.string().trim().min(1).max(50),
});

export const passCompanionsSchema = z
  .array(passCompanionSchema)
  .max(MAX_PASS_COMPANIONS, 'max_companions')
  .superRefine((companions, ctx) => {
    const seen = new Set<string>();
    companions.forEach((companion, index) => {
      const document = companion.document.trim().toLowerCase();
      if (seen.has(document)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, 'document'],
          message: 'duplicate_companion_document',
        });
      }
      seen.add(document);
    });
  });

export const createPassSchema = z
  .object({
    /** Entry and exit pairs. Ignored for entry-only passes, which always use one. */
    maxUses: z.coerce.number().int().min(1).max(20).optional(),
    recurrence: z.enum(['once', 'range', 'weekly']).optional(),
    /**
     * Any node of the structure is a valid candidate. Whether it is a home or a
     * common area — and whether the requester may use it — is decided in the
     * service, because it needs the node and its level-1 ancestor.
     */
    locationUnitId: z.string().uuid(),
    visitorFirstName: z.string().trim().min(1).max(120),
    visitorLastName: z.string().trim().min(1).max(120),
    visitorDocument: z.string().trim().min(1).max(50),
    /** People who arrive with the primary visitor. Never get their own QR. */
    companions: passCompanionsSchema.optional(),
    hasVehicle: z.boolean().optional(),
    vehiclePlate: z.string().trim().max(20).nullable().optional(),
    type: passTypeSchema,
    validFrom: z.string().datetime(),
    validUntil: z.string().datetime(),
    /**
     * Weekday mask (0 = Sunday). Only meaningful for `weekly`; the other modes
     * never restrict days, so sending a mask there is a client bug, not data to
     * silently ignore.
     */
    allowedDays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
    timeFrom: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .nullable()
      .optional(),
    timeTo: z
      .string()
      .regex(/^\d{2}:\d{2}(:\d{2})?$/)
      .nullable()
      .optional(),
    pin: z
      .string()
      .regex(/^\d{4}$/)
      .nullable()
      .optional(),
  })
  .superRefine((input, ctx) => {
    const recurrence = input.recurrence ?? 'once';
    const days = input.allowedDays ?? [];

    if (recurrence === 'weekly') {
      // A weekly mode without days has no rule to evaluate at the gate, so it
      // would either allow every day or none. Both are lies: reject it.
      if (days.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['allowedDays'],
          message: 'weekly_requires_days',
        });
      }
      return;
    }

    if (days.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['allowedDays'],
        message: 'allowed_days_only_for_weekly',
      });
    }
  });

export const bindPassSchema = z.object({
  pin: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
});

export const passesQuerySchema = z.object({
  status: passStatusSchema.optional(),
  /** Free text over visitor name, last name or document. */
  search: z.string().trim().max(120).optional(),
  /** Filters the history by the node the visitor was authorized to. */
  destinationUnitId: z.string().uuid().optional(),
  /** Filters the history by the bulk operation that created the passes. */
  batchId: z.string().uuid().optional(),
  /** Sort key for the history; defaults to the creation date. */
  sort: z.enum(['createdAt', 'validFrom', 'validUntil']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  /** Creation-date range, sent as ISO instants to avoid timezone ambiguity. */
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

/**
 * A batch shares destination, type and window; visitors come from a CSV file.
 * The 200-row cap is enforced here, but the route maps `too_big` failures of
 * this array to the `batch_too_large` reason the UI expects.
 */
export const createPassBatchSchema = z.object({
  maxUses: z.coerce.number().int().min(1).max(20).optional(),
  recurrence: z.enum(['once', 'range', 'weekly']).optional(),
  destination: z.string().uuid(),
  type: passTypeSchema,
  validFrom: z.string().datetime(),
  validUntil: z.string().datetime(),
  batchLabel: z.string().trim().max(80).nullable().optional(),
  visitors: z
    .array(
      z.object({
        firstName: z.string().trim().min(1).max(120),
        lastName: z.string().trim().min(1).max(120),
        document: z.string().trim().min(1).max(50),
        vehiclePlate: z.string().trim().max(20).nullable().optional(),
        companions: passCompanionsSchema.optional(),
      }),
    )
    .min(1)
    .max(200),
});

export const scanPassSchema = z.object({
  token: z.string().min(1),
});

/** Guard observation: optional free text, trimmed and capped by the API. */
const scanNoteSchema = z.string().trim().max(500);

export const scanConfirmSchema = z.object({
  note: scanNoteSchema.optional(),
});

export const scanDecisionSchema = z.object({
  reason: scanNoteSchema.optional(),
  note: scanNoteSchema.optional(),
});

export const scansQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(ScanStatusValues as [string, ...string[]]).optional(),
  action: z.enum(ScanActionValues as [string, ...string[]]).optional(),
});

const accessPointTypeSchema = z.enum(['door', 'gate', 'turnstile']);
const accessPointDirectionSchema = z.enum(['entry', 'exit', 'both']);
const accessPointFailPolicySchema = z.enum(['open', 'closed']);

export const createAccessPointSchema = z.object({
  name: z.string().trim().min(1).max(255),
  type: accessPointTypeSchema.optional(),
  direction: accessPointDirectionSchema.optional(),
  gpioPin: z.number().int().min(0).nullable().optional(),
  failPolicy: accessPointFailPolicySchema.optional(),
});

export const updateAccessPointSchema = createAccessPointSchema.partial().extend({
  active: z.boolean().optional(),
});

export const startShiftSchema = z.object({
  accessPointId: z.string().uuid().optional(),
  source: z.enum(['app', 'dashboard']).optional(),
});

export const changeAccessPointSchema = z.object({
  accessPointId: z.string().uuid(),
  source: z.enum(['app', 'dashboard']).optional(),
});

export const endShiftSchema = z.object({
  source: z.enum(['app', 'dashboard']).optional(),
});

export const forceCloseShiftSchema = z.object({
  reason: z.string().trim().min(1).max(500),
});

export const shiftsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  communityId: z.string().uuid().optional(),
  status: z.enum(['open', 'closed']).optional(),
});

export const activeGuardsQuerySchema = z.object({
  communityId: z.string().uuid(),
  accessPointId: z.string().uuid(),
});

export const bitacoraQuerySchema = z.object({
  communityId: z.string().uuid().optional(),
  accessPointId: z.string().uuid().optional(),
  shiftId: z.string().uuid().optional(),
  /** Persona que operó la portería (actor del evento). */
  guardId: z.string().uuid().optional(),
  type: z.enum(BitacoraEntryTypeValues as [string, ...string[]]).optional(),
  /** Resultado legible derivado del tipo y del motivo. */
  result: z.enum(BitacoraResultValues as [string, ...string[]]).optional(),
  /**
   * Comma separated list of entry types. The board groups the access events and
   * asks for them at once, because the guard already has a separate tab for the
   * shifts and their start/end entries only duplicate that table.
   */
  types: z.string().optional(),
  /**
   * Comma separated list of entry types to leave out. The board hides the shift
   * events by default, because the shifts have their own tab.
   */
  excludeTypes: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export const bitacoraGuardsQuerySchema = z.object({
  communityId: z.string().uuid().optional(),
});

export const createBitacoraEntrySchema = z.object({
  accessPointId: z.string().uuid(),
  summary: z.string().trim().min(1).max(500),
  details: z.record(z.unknown()).optional(),
});

export const createBitacoraCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
});
