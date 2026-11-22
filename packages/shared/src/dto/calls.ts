export interface CreateCallDto {
  callId: string;
  kioskId: string;
  visitor?: {
    name?: string;
    known?: boolean;
  } | null;
}

export interface UpdateCallDto {
  status?: 'active' | 'ended' | 'missed';
  operatorPersonId?: string;
  /** @deprecated usar operatorPersonId */
  operatorId?: string;
  endedAt?: string;
  duration?: number;
  eventType?: 'call.ended' | 'call.missed';
}
