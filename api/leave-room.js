import { Redis } from '@upstash/redis';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { code, token } = req.body ?? {};
    if (!code || !token) return res.status(400).json({ error: 'Paramètres manquants' });

    const pseudo = await redis.get(`token:${token}`);
    if (!pseudo) return res.status(401).json({ error: 'Session expirée' });

    const rawRoom = await redis.get(`room:${code.toUpperCase()}`);
    if (!rawRoom) return res.status(200).json({ ok: true }); // Room already gone, fine

    const room = typeof rawRoom === 'string' ? JSON.parse(rawRoom) : rawRoom;

    // Only the guest can leave (or re-entry)
    if (room.guest === pseudo) {
        delete room.guest;
        room.state = 'waiting';
        await redis.set(`room:${code.toUpperCase()}`, JSON.stringify(room), { ex: 1800 });
    }

    return res.status(200).json({ ok: true });
}
