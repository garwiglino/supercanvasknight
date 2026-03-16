import { Redis } from '@upstash/redis';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    const token = req.method === 'GET' ? req.query?.token : req.body?.token;
    if (!token) return res.status(400).json({ error: 'Token manquant' });

    const pseudo = await redis.get(`token:${token}`);
    if (!pseudo) return res.status(401).json({ error: 'Session expirée' });

    const key = `profile:${pseudo.toLowerCase()}`;

    if (req.method === 'GET') {
        const raw = await redis.get(key);
        const profile = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : { level: 1, xp: 0, maxXp: 50, totalKills: 0, gamesPlayed: 0 };
        return res.status(200).json(profile);
    }

    if (req.method === 'POST') {
        const { level, xp, maxXp, totalKills, gamesPlayed } = req.body ?? {};
        const profile = { level: level || 1, xp: xp || 0, maxXp: maxXp || 50, totalKills: totalKills || 0, gamesPlayed: gamesPlayed || 0 };
        await redis.set(key, JSON.stringify(profile), { ex: 604800 * 52 });
        return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
}
