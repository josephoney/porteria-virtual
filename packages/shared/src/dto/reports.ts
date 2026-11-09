export interface DailyReportQuery {
  date?: string;
  communityId?: string;
}

export interface WeeklyReportQuery {
  week?: string;
  communityId?: string;
}

export interface MonthlyReportQuery {
  month?: string;
  communityId?: string;
}

export interface CallStatsQuery {
  from?: string;
  to?: string;
  communityId?: string;
}

export interface EventBreakdownQuery {
  from: string;
  to: string;
  bucket?: 'hour' | 'day';
  communityId?: string;
}

export interface CreateEventDto {
  eventType: string;
  organizationId?: string;
  communityId?: string;
  actorId?: string;
  actorRole?: string;
  accessPointId?: string;
  metadata?: Record<string, unknown>;
}
