import type { PassTicketTone } from '@porteria/shared';

export const TICKET_TONE_BACKGROUNDS: Record<PassTicketTone, string> = {
  success: '#39C27F',
  warning: '#F2B84B',
  danger: '#F26D6D',
  neutral: '#E2E8F0',
};

export const TICKET_TONE_TEXT: Record<PassTicketTone, string> = {
  success: '#081018',
  warning: '#081018',
  danger: '#081018',
  neutral: '#0B1220',
};
