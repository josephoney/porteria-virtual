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
