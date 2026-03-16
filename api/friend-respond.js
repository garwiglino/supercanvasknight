import { Redis } from '@upstash/redis';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

async function getFriends(key) {
    const raw = await redis.get(`friends:${key}`);
    return raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { token, from, accept } = req.body ?? {};
    if (!token || !from) return res.status(400).json({ error: 'Paramètres manquants' });

    const pseudo = await redis.get(`token:${token}`);
    if (!pseudo) return res.status(401).json({ error: 'Session expirée' });

    const myKey = pseudo.toLowerCase();
    const fromKey = from.toLowerCase();

    const reqKey = `friend-reqs:${myKey}`;
    const rawReqs = await redis.get(reqKey);
    const reqs = rawReqs ? (typeof rawReqs === 'string' ? JSON.parse(rawReqs) : rawReqs) : [];
    const filtered = reqs.filter(r => r.from.toLowerCase() !== fromKey);
    await redis.set(reqKey, JSON.stringify(filtered), { ex: 604800 * 4 });

    if (accept) {
        const [myFriends, theirFriends] = await Promise.all([getFriends(myKey), getFriends(fromKey)]);
        if (!myFriends.some(f => f.toLowerCase() === fromKey)) myFriends.push(from);
        if (!theirFriends.some(f => f.toLowerCase() === myKey)) theirFriends.push(pseudo);
        await Promise.all([
            redis.set(`friends:${myKey}`, JSON.stringify(myFriends), { ex: 604800 * 52 }),
            redis.set(`friends:${fromKey}`, JSON.stringify(theirFriends), { ex: 604800 * 52 }),
        ]);
    }

    return res.status(200).json({ ok: true });
}
