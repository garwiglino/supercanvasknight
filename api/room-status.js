import { Redis } from '@upstash/redis';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { code } = req.body ?? {};
    if (!code) return res.status(400).json({ error: 'Code manquant' });

    const raw = await redis.get(`room:${code}`);
    if (!raw) return res.status(404).json({ error: 'Partie introuvable ou expirée' });

    const room = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return res.status(200).json({ host: room.host, guest: room.guest, state: room.state });
}
