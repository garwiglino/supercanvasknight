import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { pseudo, password } = req.body ?? {};

    if (!pseudo || typeof pseudo !== 'string' || pseudo.trim().length < 3 || pseudo.trim().length > 12) {
        return res.status(400).json({ error: 'Pseudo invalide (3–12 caractères)' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });
    }

    const normalizedPseudo = pseudo.trim();
    const key = `user:${normalizedPseudo.toLowerCase()}`;

    const existing = await redis.get(key);
    if (existing) {
        return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
    }

    const salt = process.env.AUTH_SALT ?? 'sckt_default_salt_change_me';
    const hash = crypto.createHash('sha256').update(password + salt).digest('hex');

    await redis.set(key, JSON.stringify({ pseudo: normalizedPseudo, hash, createdAt: Date.now() }));

    const token = crypto.randomBytes(32).toString('hex');
    await redis.set(`token:${token}`, normalizedPseudo, { ex: 604800 });

    return res.status(200).json({ token, pseudo: normalizedPseudo });
}
