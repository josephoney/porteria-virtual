export interface DailyReport {
  date: string;
  totalCalls: number;
  answeredCalls: number;
  missedCalls: number;
  callsByHour: { hour: number; count: number }[];
  totalDoorOpens: number;
  eventsByType: { eventType: string; count: number }[];
  activeOperators: number;
}

export interface WeeklyReport {
  weekStart: string;
  days: {
    date: string;
    totalCalls: number;
    answeredCalls: number;
    missedCalls: number;
    doorOpens: number;
  }[];
  totals: {
    calls: number;
    answered: number;
    missed: number;
    doors: number;
  };
}

export interface MonthlyReport {
  month: string;
  weeks: {
    weekStart: string;
    totalCalls: number;
    answeredCalls: number;
    missedCalls: number;
    doorOpens: number;
  }[];
  totals: {
    calls: number;
    answered: number;
    missed: number;
    doors: number;
  };
}

export interface CallStats {
  totalCalls: number;
  answeredCount: number;
  missedCount: number;
  answerRate: number;
  avgDuration: number;
  callsByHour: { hour: number; count: number }[];
  callsByKiosk: { kioskId: string; kioskName: string; count: number }[];
}

export interface EventTimeSeries {
  buckets: { time: string; [eventType: string]: number | string }[];
}

/** Granularidad de la serie de accesos. */
export type ReportGranularity = 'day' | 'week' | 'month';

/** Alcance efectivo con el que se resolvió un reporte. */
export interface ReportScope {
  organizationId: string;
  communityId: string | null;
}

export interface AccessReportTotals {
  /** Total de filas de acceso de la bitácora en el período. */
  total: number;
  /** pass_entry / pass_exit. */
  authorized: number;
  /** Rechazos que no son fallas del código. */
  denied: number;
  /** scan_denied cuyo motivo es una falla del código. */
  codeFailure: number;
  /** Entradas manuales: observaciones del guardia. */
  observation: number;
  entries: number;
  exits: number;
}

export interface AccessReportMethodCount {
  /** `document` cuando la bitácora tiene `source = 'manual_identity'`. */
  method: 'qr' | 'document';
  count: number;
}

export interface AccessReportAccessPointCount {
  accessPointId: string | null;
  accessPointName: string;
  count: number;
}

export interface AccessReportHourCount {
  hour: number;
  count: number;
}

export interface AccessReportDenialReason {
  reason: string;
  count: number;
}

/** Punto de la serie; `date` es YYYY-MM-DD (día o lunes) o YYYY-MM (mes). */
export interface AccessReportSeriesPoint {
  date: string;
  total: number;
  authorized: number;
  denied: number;
  codeFailure: number;
  observation: number;
  entries: number;
  exits: number;
}

/**
 * Latencia de confirmación medida sólo sobre accesos con un escaneo QR
 * confirmado. `confirmedScans / accessCount` es la cobertura real del dato.
 */
export interface AccessReportLatency {
  averageSeconds: number | null;
  confirmedScans: number;
  accessCount: number;
}

export interface AccessReport {
  from: string;
  to: string;
  granularity: ReportGranularity;
  scope: ReportScope;
  totals: AccessReportTotals;
  byMethod: AccessReportMethodCount[];
  byAccessPoint: AccessReportAccessPointCount[];
  byHour: AccessReportHourCount[];
  denialReasons: AccessReportDenialReason[];
  latency: AccessReportLatency;
  series: AccessReportSeriesPoint[];
}

export interface ShiftReportShift {
  shiftId: string;
  guardPersonId: string;
  guardName: string;
  status: 'open' | 'closed';
  startedAt: string;
  endedAt: string | null;
  /** Horas cumplidas; `null` cuando el turno sigue abierto. */
  hours: number | null;
  accesses: number;
}

export interface ShiftReportGuard {
  guardPersonId: string;
  guardName: string;
  shifts: number;
  openShifts: number;
  closedShifts: number;
  /** Suma de las horas de los turnos cerrados; un turno abierto no suma cero. */
  hours: number;
  accesses: number;
}

export interface ShiftReportOpenShift {
  shiftId: string;
  guardPersonId: string;
  guardName: string;
  startedAt: string;
}

export interface ShiftReport {
  from: string;
  to: string;
  scope: ReportScope;
  totals: {
    shifts: number;
    openShifts: number;
    closedShifts: number;
    hours: number;
    accesses: number;
  };
  guards: ShiftReportGuard[];
  shifts: ShiftReportShift[];
  openShifts: ShiftReportOpenShift[];
}
