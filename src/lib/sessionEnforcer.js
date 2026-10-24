import { AuthModel } from '@/models/AuthModel';

/**
 * Single-device session enforcement utilities.
 * Delegates to AuthModel for MVC separation of concerns.
 */
export async function createSession(userId) {
  return await AuthModel.createSession(userId);
}

export async function validateSession(userId) {
  return await AuthModel.validateSession(userId);
}

export function clearSession() {
  return AuthModel.clearLocalSession();
}

export function subscribeToSessionChanges(userId, onKicked) {
  return AuthModel.subscribeToSessionChanges(userId, onKicked);
}

export default createSession;
