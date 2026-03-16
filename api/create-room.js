import { Redis } from '@upstash/redis';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // pas I/O pour éviter confusion 1/0

function generateCode() {
    let code = '';
    for (let i = 0; i < 6; i++) code += CHARS[Math.floor(Math.random() * CHARS.length)];
    return code;
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { token } = req.body ?? {};
    if (!token) return res.status(401).json({ error: 'Non authentifié' });

    const pseudo = await redis.get(`token:${token}`);
    if (!pseudo) return res.status(401).json({ error: 'Session expirée' });

    // Générer un code unique
    let code, attempts = 0;
    do {
        code = generateCode();
        attempts++;
    } while (await redis.get(`room:${code}`) && attempts < 10);

    const room = { host: pseudo, guest: null, state: 'waiting', createdAt: Date.now() };
    await redis.set(`room:${code}`, JSON.stringify(room), { ex: 1800 }); // expire 30min

    return res.status(200).json({ code });
}
