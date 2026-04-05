import { OAuth2Client } from 'google-auth-library';
import { env } from '../config/env';
import { AppError } from '../middleware/error.middleware';

let client: OAuth2Client | null = null;

function getClient(): OAuth2Client | null {
  if (!env.GOOGLE_CLIENT_ID) return null;
  if (!client) client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  return client;
}

export async function verifyGoogleIdToken(idToken: string) {
  const c = getClient();
  if (!c) throw new AppError('Google sign-in is not configured', 503);

  try {
    const ticket = await c.verifyIdToken({
      idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });
    const p = ticket.getPayload();
    if (!p?.sub || !p.email) throw new AppError('Invalid Google token', 401);
    return {
      googleId: p.sub,
      email: p.email,
      name: p.name?.trim() || p.email.split('@')[0],
      photo: p.picture,
    };
  } catch (e) {
    if (e instanceof AppError) throw e;
    throw new AppError('Invalid Google token', 401);
  }
}
