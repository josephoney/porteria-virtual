export type PassErrorCode =
  | 'not_found'
  | 'forbidden'
  | 'conflict'
  | 'gone'
  | 'invalid'
  | 'recurring_not_available'
  | 'allowed_days_reserved'
  | 'link_expired'
  | 'pass_used'
  | 'not_bound'
  | 'device_already_bound'
  | 'invalid_pin'
  | 'pin_locked'
  | 'not_valid_now'
  | 'out_of_days'
  | 'out_of_schedule'
  | 'daily_uses_exhausted'
  | 'dynamic_qr_disabled'
  | 'invalid_or_expired_token'
  | 'token_already_used'
  | 'scan_expired'
  | 'scan_already_processed'
  | 'pass_expired'
  | 'daily_limit_reached'
  | 'rate_limited'
  | 'no_active_shift'
  | 'not_on_shift_at_access_point'
  | 'foreign_community'
  | 'destination_inactive'
  | 'batch_too_large';

/**
 * What a route needs to keep the device authorized on the way back: the pass
 * that was just authorized, when its link expires, and the legacy cookie value
 * when that is the binding the request proved.
 */
export interface PassGrant {
  passId: string;
  linkExpiresAt: Date;
  legacyCookie: string | null;
}

export type PassResult<T> =
  | { ok: true; data: T; grant?: PassGrant }
  | {
      ok: false;
      code: PassErrorCode;
      /** Present on `daily_limit_reached`: the maximum the community allows. */
      max?: number;
    };
