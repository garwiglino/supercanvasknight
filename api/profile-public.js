import { Redis } from '@upstash/redis';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

const DEFAULTS = { level: 1, xp: 0, maxXp: 50, totalKills: 0, gamesPlayed: 0, avatarId: 1, bgId: 1, bio: '' };

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();
    const { pseudo } = req.query ?? {};
    if (!pseudo) return res.status(400).json({ error: 'Pseudo manquant' });

    // Verify user exists
    const userRaw = await redis.get(`user:${pseudo.toLowerCase()}`);
    if (!userRaw) return res.status(404).json({ error: 'Joueur introuvable' });
    const user = typeof userRaw === 'string' ? JSON.parse(userRaw) : userRaw;

    const raw = await redis.get(`profile:${pseudo.toLowerCase()}`);
    const profile = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : { ...DEFAULTS };
    return res.status(200).json({ pseudo: user.pseudo, ...DEFAULTS, ...profile });
}
