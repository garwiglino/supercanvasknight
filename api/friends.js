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
    // GET — liste amis + demandes
    if (req.method === 'GET') {
        const { token } = req.query ?? {};
        if (!token) return res.status(400).json({ error: 'Token manquant' });

        const pseudo = await redis.get(`token:${token}`);
        if (!pseudo) return res.status(401).json({ error: 'Session expirée' });

        const key = pseudo.toLowerCase();
        const [rawFriends, rawReqs] = await Promise.all([
            redis.get(`friends:${key}`),
            redis.get(`friend-reqs:${key}`)
        ]);

        const friends  = rawFriends ? (typeof rawFriends === 'string' ? JSON.parse(rawFriends) : rawFriends) : [];
        const requests = rawReqs    ? (typeof rawReqs    === 'string' ? JSON.parse(rawReqs)    : rawReqs)    : [];
        return res.status(200).json({ friends, requests });
    }

    // POST — action: 'request' | 'respond' | 'unfriend'
    if (req.method === 'POST') {
        const { token, action } = req.body ?? {};
        if (!token || !action) return res.status(400).json({ error: 'Paramètres manquants' });

        const pseudo = await redis.get(`token:${token}`);
        if (!pseudo) return res.status(401).json({ error: 'Session expirée' });

        // ── Envoyer une demande d'ami ──────────────────────────────
        if (action === 'request') {
            const { to } = req.body;
            if (!to) return res.status(400).json({ error: 'Paramètres manquants' });
            if (pseudo.toLowerCase() === to.toLowerCase())
                return res.status(400).json({ error: 'Tu ne peux pas t\'ajouter toi-même' });

            const targetRaw = await redis.get(`user:${to.toLowerCase()}`);
            if (!targetRaw) return res.status(404).json({ error: 'Joueur introuvable' });
            const target = typeof targetRaw === 'string' ? JSON.parse(targetRaw) : targetRaw;

            const friends = await getFriends(pseudo.toLowerCase());
            if (friends.some(f => f.toLowerCase() === to.toLowerCase()))
                return res.status(400).json({ error: 'Déjà ami' });

            const reqKey  = `friend-reqs:${to.toLowerCase()}`;
            const rawReqs = await redis.get(reqKey);
            const reqs    = rawReqs ? (typeof rawReqs === 'string' ? JSON.parse(rawReqs) : rawReqs) : [];
            if (reqs.some(r => r.from.toLowerCase() === pseudo.toLowerCase()))
                return res.status(400).json({ error: 'Demande déjà envoyée' });

            reqs.push({ from: pseudo });
            await redis.set(reqKey, JSON.stringify(reqs), { ex: 604800 * 4 });
            return res.status(200).json({ ok: true, targetPseudo: target.pseudo });
        }

        // ── Accepter / refuser une demande ────────────────────────
        if (action === 'respond') {
            const { from, accept } = req.body;
            if (!from) return res.status(400).json({ error: 'Paramètres manquants' });

            const myKey   = pseudo.toLowerCase();
            const fromKey = from.toLowerCase();
            const reqKey  = `friend-reqs:${myKey}`;
            const rawReqs = await redis.get(reqKey);
            const reqs    = rawReqs ? (typeof rawReqs === 'string' ? JSON.parse(rawReqs) : rawReqs) : [];

            await redis.set(reqKey, JSON.stringify(reqs.filter(r => r.from.toLowerCase() !== fromKey)), { ex: 604800 * 4 });

            if (accept) {
                const [myFriends, theirFriends] = await Promise.all([getFriends(myKey), getFriends(fromKey)]);
                if (!myFriends.some(f => f.toLowerCase() === fromKey))    myFriends.push(from);
                if (!theirFriends.some(f => f.toLowerCase() === myKey)) theirFriends.push(pseudo);
                await Promise.all([
                    redis.set(`friends:${myKey}`,   JSON.stringify(myFriends),    { ex: 604800 * 52 }),
                    redis.set(`friends:${fromKey}`, JSON.stringify(theirFriends), { ex: 604800 * 52 }),
                ]);
            }
            return res.status(200).json({ ok: true });
        }

        // ── Supprimer un ami ──────────────────────────────────────
        if (action === 'unfriend') {
            const { target } = req.body;
            if (!target) return res.status(400).json({ error: 'Paramètres manquants' });

            const keyA = pseudo.toLowerCase();
            const keyB = target.toLowerCase();
            const [listA, listB] = await Promise.all([getFriends(keyA), getFriends(keyB)]);

            await Promise.all([
                redis.set(`friends:${keyA}`, JSON.stringify(listA.filter(f => f.toLowerCase() !== keyB)), { ex: 604800 * 52 }),
                redis.set(`friends:${keyB}`, JSON.stringify(listB.filter(f => f.toLowerCase() !== keyA)), { ex: 604800 * 52 }),
            ]);
            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ error: 'Action inconnue' });
    }

    return res.status(405).end();
}
