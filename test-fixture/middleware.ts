import { validateUser } from './auth';

export function authMiddleware(req: any, res: any, next: Function): void {
    if (!validateUser(req.headers['x-email'], req.headers['x-token'])) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
    }
    next();
}
