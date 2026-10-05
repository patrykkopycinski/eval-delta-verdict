import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import argon2 from 'argon2';
import { config, SESSION_COOKIE, SESSION_TTL_SECONDS } from './config';
import { es } from './es';
import { createSessionToken, verifySessionToken, type Role, type Session } from './session';
import { can, type Action } from './permissions';

export interface UserDoc {
  username: string;
  role: Role;
  password_hash: string;
  created_at: string;
}

// Hash of a throwaway password so unknown-user logins cost the same as real ones.
let dummyHash: Promise<string> | undefined;

export async function findUser(username: string): Promise<UserDoc | null> {
  try {
    const r = await es().get<UserDoc>({ index: config.usersIndex, id: username });
    return r._source ?? null;
  } catch {
    return null;
  }
}

export async function verifyLogin(username: string, password: string): Promise<UserDoc | null> {
  const user = await findUser(username);
  if (!user) {
    dummyHash ??= argon2.hash('edv-dummy-password');
    await argon2.verify(await dummyHash, password).catch(() => false);
    return null;
  }
  const ok = await argon2.verify(user.password_hash, password).catch(() => false);
  return ok ? user : null;
}

export async function startSession(user: { username: string; role: Role }): Promise<void> {
  const token = createSessionToken(user, config.sessionSecret, SESSION_TTL_SECONDS);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.EDV_COOKIE_SECURE === 'true',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function endSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function getSession(): Promise<Session | null> {
  return verifySessionToken((await cookies()).get(SESSION_COOKIE)?.value, config.sessionSecret);
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  return s;
}

/** Throws (-> error page) when the role may not perform the action. */
export async function requireCan(action: Action, ctx: { owner?: string } = {}): Promise<Session> {
  const s = await requireSession();
  if (!can(s.r, action, { owner: ctx.owner, user: s.u })) throw new Error('Forbidden');
  return s;
}
