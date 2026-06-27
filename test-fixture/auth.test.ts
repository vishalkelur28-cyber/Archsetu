import { validateUser } from './auth';

describe('auth', () => {
    it('accepts valid credentials', () => {
        expect(validateUser('user@test.com', 'pass12345')).toBe(true);
    });

    it('rejects missing email', () => {
        expect(validateUser('', 'pass12345')).toBe(false);
    });

    it('rejects short password', () => {
        expect(validateUser('user@test.com', 'short')).toBe(false);
    });
});
