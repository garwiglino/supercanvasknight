import { Redis } from '@upstash/redis';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { token, to } = req.body ?? {};
    if (!token || !to) return res.status(400).json({ error: 'Paramètres manquants' });

    const from = await redis.get(`token:${token}`);
    if (!from) return res.status(401).json({ error: 'Session expirée' });
    if (from.toLowerCase() === to.toLowerCase()) return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même' });

    const targetRaw = await redis.get(`user:${to.toLowerCase()}`);
    if (!targetRaw) return res.status(404).json({ error: 'Joueur introuvable' });
    const target = typeof targetRaw === 'string' ? JSON.parse(targetRaw) : targetRaw;

    const friendsRaw = await redis.get(`friends:${from.toLowerCase()}`);
    const friends = friendsRaw ? (typeof friendsRaw === 'string' ? JSON.parse(friendsRaw) : friendsRaw) : [];
    if (friends.some(f => f.toLowerCase() === to.toLowerCase())) {
        return res.status(400).json({ error: 'Déjà ami' });
    }

    const reqKey = `friend-reqs:${to.toLowerCase()}`;
    const rawReqs = await redis.get(reqKey);
    const reqs = rawReqs ? (typeof rawReqs === 'string' ? JSON.parse(rawReqs) : rawReqs) : [];
    if (reqs.some(r => r.from.toLowerCase() === from.toLowerCase())) {
        return res.status(400).json({ error: 'Demande déjà envoyée' });
    }
    reqs.push({ from });
    await redis.set(reqKey, JSON.stringify(reqs), { ex: 604800 * 4 });

    return res.status(200).json({ ok: true, targetPseudo: target.pseudo });
}
