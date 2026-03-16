import { Redis } from '@upstash/redis';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { token } = req.body ?? {};
    if (!token) return res.status(400).json({ error: 'Token manquant' });

    const pseudo = await redis.get(`token:${token}`);
    if (!pseudo) return res.status(401).json({ error: 'Session expirée' });

    return res.status(200).json({ pseudo });
}
