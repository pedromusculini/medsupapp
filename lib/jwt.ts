import jwt from 'jsonwebtoken';
import { getAuthSigningSecret } from '@/lib/authSigningSecret';

export interface JwtPayload {
  sub: string;
  email: string;
  name: string;
  type: 'registration' | 'session';
}

export function signToken(payload: Omit<JwtPayload, 'type'>, type: JwtPayload['type']): string {
  return jwt.sign(
    { ...payload, type },
    getAuthSigningSecret(),
    { expiresIn: type === 'registration' ? '1h' : '7d' },
  );
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, getAuthSigningSecret()) as JwtPayload;
  } catch {
    return null;
  }
}
