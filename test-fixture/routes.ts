import { validateUser, formatDate } from './auth';

const app = {
    post: (_path: string, _handler: Function) => {},
};

app.post('/api/login', (req: any, res: any) => {
    const ok = validateUser(req.body.email, req.body.password);
    res.json({ ok, date: formatDate(new Date()) });
});

app.post('/api/register', (req: any, res: any) => {
    const ok = validateUser(req.body.email, req.body.password);
    res.json({ ok });
});

// Commented-out call — tests Bug #4 (comments counted as call sites)
// validateUser('ghost@example.com', 'shouldnotcount')
