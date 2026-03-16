import { Redis } from '@upstash/redis';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

const DEFAULTS = { level: 1, xp: 0, maxXp: 50, totalKills: 0, gamesPlayed: 0, avatarId: 1, bgId: 1, bio: '' };

export default async function handler(req, res) {
    const token = req.method === 'GET' ? req.query?.token : req.body?.token;
    if (!token) return res.status(400).json({ error: 'Token manquant' });

    const pseudo = await redis.get(`token:${token}`);
    if (!pseudo) return res.status(401).json({ error: 'Session expirée' });

    const key = `profile:${pseudo.toLowerCase()}`;

    if (req.method === 'GET') {
        const raw = await redis.get(key);
        const profile = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : { ...DEFAULTS };
        return res.status(200).json({ ...DEFAULTS, ...profile });
    }

    if (req.method === 'POST') {
        const raw = await redis.get(key);
        const existing = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : { ...DEFAULTS };
        const { level, xp, maxXp, totalKills, gamesPlayed, avatarId, bgId, bio } = req.body ?? {};
        const profile = {
            ...existing,
            ...(level      !== undefined && { level }),
            ...(xp         !== undefined && { xp }),
            ...(maxXp      !== undefined && { maxXp }),
            ...(totalKills !== undefined && { totalKills }),
            ...(gamesPlayed!== undefined && { gamesPlayed }),
            ...(avatarId   !== undefined && { avatarId }),
            ...(bgId       !== undefined && { bgId }),
            ...(bio        !== undefined && { bio: String(bio).substring(0, 120) }),
        };
        await redis.set(key, JSON.stringify(profile), { ex: 604800 * 52 });
        return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
}
