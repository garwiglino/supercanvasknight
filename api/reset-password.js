import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { token, newPassword } = req.body ?? {};
    if (!token || !newPassword) {
        return res.status(400).json({ error: 'Paramètres manquants' });
    }
    if (newPassword.length < 6) {
        return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });
    }

    const pseudo = await redis.get(`reset:${token}`);
    if (!pseudo) {
        return res.status(400).json({ error: 'Lien invalide ou expiré' });
    }

    const userKey = `user:${pseudo.toLowerCase()}`;
    const raw = await redis.get(userKey);
    if (!raw) return res.status(404).json({ error: 'Utilisateur introuvable' });

    const user = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const salt = process.env.AUTH_SALT ?? 'sckt_default_salt_change_me';
    const hash = crypto.createHash('sha256').update(newPassword + salt).digest('hex');

    user.hash = hash;
    await redis.set(userKey, JSON.stringify(user));
    await redis.del(`reset:${token}`);

    // Créer une session directement
    const sessionToken = crypto.randomBytes(32).toString('hex');
    await redis.set(`token:${sessionToken}`, user.pseudo, { ex: 604800 });

    return res.status(200).json({ ok: true, token: sessionToken, pseudo: user.pseudo });
}
