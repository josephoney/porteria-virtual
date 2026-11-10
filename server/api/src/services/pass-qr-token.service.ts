import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import config from '../config.js';

const ALGORITHM = 'HS256' as const;

export interface PassQrPayload {
  v: 1;
  passId: string;
  jti: string;
  iat: number;
  exp: number;
}

export interface SignedPassQrToken {
  token: string;
  jti: string;
  expiresAt: Date;
}

export function signPassQrToken(passId: string): SignedPassQrToken {
  const jti = randomUUID();
  const ttlSeconds = config.passes.qrTtlSeconds;
  const token = jwt.sign({ v: 1, passId }, config.passes.qrSecret, {
    algorithm: ALGORITHM,
    jwtid: jti,
    expiresIn: ttlSeconds,
  });

  return {
    token,
    jti,
    expiresAt: new Date(Date.now() + ttlSeconds * 1000),
  };
}

export function verifyPassQrToken(token: string): PassQrPayload {
  const decoded = jwt.verify(token, config.passes.qrSecret, {
    algorithms: [ALGORITHM],
  });

  if (
    typeof decoded === 'string' ||
    decoded.v !== 1 ||
    typeof decoded.passId !== 'string' ||
    typeof decoded.jti !== 'string' ||
    typeof decoded.iat !== 'number' ||
    typeof decoded.exp !== 'number'
  ) {
    throw new Error('Invalid pass QR token');
  }

  return {
    v: 1,
    passId: decoded.passId,
    jti: decoded.jti,
    iat: decoded.iat,
    exp: decoded.exp,
  };
}
