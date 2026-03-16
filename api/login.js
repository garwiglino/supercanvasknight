import { kv } from '@vercel/kv';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { pseudo, password } = req.body ?? {};

    if (!pseudo || !password) {
        return res.status(400).json({ error: 'Pseudo et mot de passe requis' });
    }

    const key = `user:${pseudo.trim().toLowerCase()}`;
    const user = await kv.get(key);

    if (!user) {
        return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect' });
    }

    // Vérification du hash
    const salt = process.env.AUTH_SALT ?? 'sckt_default_salt_change_me';
    const hash = crypto.createHash('sha256').update(password + salt).digest('hex');

    if (hash !== user.hash) {
        return res.status(401).json({ error: 'Pseudo ou mot de passe incorrect' });
    }

    // Nouveau token de session (7 jours)
    const token = crypto.randomBytes(32).toString('hex');
    await kv.set(`token:${token}`, user.pseudo, { ex: 604800 });

    return res.status(200).json({ token, pseudo: user.pseudo });
}
