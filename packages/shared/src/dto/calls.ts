export interface CreateCallDto {
  callId: string;
  buildingId: string;
  visitor?: {
    name?: string;
    known?: boolean;
  } | null;
}

export interface UpdateCallDto {
  status?: 'active' | 'ended' | 'missed';
  operatorId?: string;
  endedAt?: string;
  duration?: number;
  eventType?: 'call.ended' | 'call.missed';
}
