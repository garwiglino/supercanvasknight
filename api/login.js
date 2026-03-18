import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { pseudo, password } = req.body ?? {};

    if (!pseudo || !password) {
        return res.status(400).json({ error: 'Pseudo et mot de passe requis' });
    }

    // ── Compte de test (dev) ─────────────────────────────────────
    if (pseudo.trim().toLowerCase() === 'usertest' && password === '1234') {
        const testPseudo = 'UserTest';
        const userKey = `user:${testPseudo.toLowerCase()}`;
        const exists = await redis.get(userKey);
        if (!exists) {
            const salt = process.env.AUTH_SALT ?? 'sckt_default_salt_change_me';
            const hash = crypto.createHash('sha256').update('1234' + salt).digest('hex');
            await redis.set(userKey, JSON.stringify({ pseudo: testPseudo, hash, email: 'test@test.dev', createdAt: Date.now() }));
        }
        const token = crypto.randomBytes(32).toString('hex');
        await redis.set(`token:${token}`, testPseudo, { ex: 604800 });
        return res.status(200).json({ token, pseudo: testPseudo });
    }

    const key = `user:${pseudo.trim().toLowerCase()}`;
    const raw = await redis.get(key);

    if (!raw) {
        return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect' });
    }

    const user = typeof raw === 'string' ? JSON.parse(raw) : raw;

    const salt = process.env.AUTH_SALT ?? 'sckt_default_salt_change_me';
    const hash = crypto.createHash('sha256').update(password + salt).digest('hex');

    if (hash !== user.hash) {
        return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    await redis.set(`token:${token}`, user.pseudo, { ex: 604800 });

    return res.status(200).json({ token, pseudo: user.pseudo });
}
