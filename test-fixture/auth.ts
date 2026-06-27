/**
 * Test fixture: auth module.
 *
 * validateUser   — exported, called from 3 files (routes ×2, middleware ×1, Login.tsx ×1) = 4 sites
 * hashPassword   — NOT exported, NOT called anywhere  → dead code
 * formatDate     — exported arrow function, called ONCE in routes.ts → tests Bug #3
 */

export function validateUser(email: string, password: string): boolean {
    if (!email || !password) { return false; }
    if (email.includes('@') && password.length >= 8) { return true; }
    return false;
}

function hashPassword(pwd: string): string {
    return pwd + '_hashed_' + pwd.length;
}

export const formatDate = (d: Date): string => d.toISOString().split('T')[0];

export class AuthService {
    login(email: string, password: string): boolean {
        return validateUser(email, password);
    }
}
