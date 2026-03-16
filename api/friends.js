import { Redis } from '@upstash/redis';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).end();
    const { token } = req.query ?? {};
    if (!token) return res.status(400).json({ error: 'Token manquant' });

    const pseudo = await redis.get(`token:${token}`);
    if (!pseudo) return res.status(401).json({ error: 'Session expirée' });

    const key = pseudo.toLowerCase();
    const [rawFriends, rawReqs] = await Promise.all([
        redis.get(`friends:${key}`),
        redis.get(`friend-reqs:${key}`)
    ]);

    const friends = rawFriends ? (typeof rawFriends === 'string' ? JSON.parse(rawFriends) : rawFriends) : [];
    const requests = rawReqs ? (typeof rawReqs === 'string' ? JSON.parse(rawReqs) : rawReqs) : [];

    return res.status(200).json({ friends, requests });
}
