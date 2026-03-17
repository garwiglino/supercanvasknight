import { Redis } from '@upstash/redis';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { token, target } = req.body;
    if (!token || !target) return res.status(400).json({ error: 'Paramètres manquants' });

    const pseudo = await redis.get(`token:${token}`);
    if (!pseudo) return res.status(401).json({ error: 'Non authentifié' });

    const keyA = pseudo.toLowerCase();
    const keyB = target.toLowerCase();

    const [rawA, rawB] = await Promise.all([
        redis.get(`friends:${keyA}`),
        redis.get(`friends:${keyB}`),
    ]);

    const listA = rawA ? (typeof rawA === 'string' ? JSON.parse(rawA) : rawA) : [];
    const listB = rawB ? (typeof rawB === 'string' ? JSON.parse(rawB) : rawB) : [];

    await Promise.all([
        redis.set(`friends:${keyA}`, JSON.stringify(listA.filter(f => f.toLowerCase() !== keyB))),
        redis.set(`friends:${keyB}`, JSON.stringify(listB.filter(f => f.toLowerCase() !== keyA))),
    ]);

    return res.status(200).json({ ok: true });
}
