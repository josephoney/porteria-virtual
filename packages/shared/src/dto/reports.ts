export interface DailyReportQuery {
  date?: string;
}

export interface WeeklyReportQuery {
  week?: string;
}

export interface MonthlyReportQuery {
  month?: string;
}

export interface CallStatsQuery {
  from?: string;
  to?: string;
}

export interface EventBreakdownQuery {
  from: string;
  to: string;
  bucket?: 'hour' | 'day';
}

export interface CreateEventDto {
  eventType: string;
  organizationId: string;
  actorId?: string;
  actorRole?: string;
  locationId?: string;
  accessPointId?: string;
  metadata?: Record<string, unknown>;
}
