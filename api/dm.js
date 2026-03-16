import { Redis } from '@upstash/redis';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

const MAX_MESSAGES = 100;
const TTL = 60 * 60 * 24 * 30; // 30 jours

function dmKey(a, b) {
    const [x, y] = [a.toLowerCase(), b.toLowerCase()].sort();
    return `dm:${x}:${y}`;
}

export default async function handler(req, res) {
    const token = req.method === 'GET' ? req.query?.token : req.body?.token;
    if (!token) return res.status(400).json({ error: 'Token manquant' });

    const pseudo = await redis.get(`token:${token}`);
    if (!pseudo) return res.status(401).json({ error: 'Session expirée' });

    // GET — charger l'historique avec un interlocuteur
    if (req.method === 'GET') {
        const { with: withPseudo } = req.query ?? {};
        if (!withPseudo) return res.status(400).json({ error: 'Paramètre "with" manquant' });
        const key = dmKey(pseudo, withPseudo);
        const raw = await redis.get(key);
        const messages = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];
        return res.status(200).json({ messages });
    }

    // POST — sauvegarder un message
    if (req.method === 'POST') {
        const { to, message } = req.body ?? {};
        if (!to || !message) return res.status(400).json({ error: 'Paramètres manquants' });

        const key = dmKey(pseudo, to);
        const raw = await redis.get(key);
        const messages = raw ? (typeof raw === 'string' ? JSON.parse(raw) : raw) : [];

        messages.push({ from: pseudo, to, message: String(message).substring(0, 500), ts: Date.now() });
        if (messages.length > MAX_MESSAGES) messages.splice(0, messages.length - MAX_MESSAGES);

        await redis.set(key, JSON.stringify(messages), { ex: TTL });
        return res.status(200).json({ ok: true });
    }

    return res.status(405).end();
}
