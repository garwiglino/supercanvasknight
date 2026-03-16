import { kv } from '@vercel/kv';
import crypto from 'crypto';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const { pseudo, password } = req.body ?? {};

    // Validation
    if (!pseudo || typeof pseudo !== 'string' || pseudo.trim().length < 3 || pseudo.trim().length > 12) {
        return res.status(400).json({ error: 'Pseudo invalide (3–12 caractères)' });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });
    }

    const normalizedPseudo = pseudo.trim();
    const key = `user:${normalizedPseudo.toLowerCase()}`;

    // Vérifier si le pseudo existe déjà
    const existing = await kv.get(key);
    if (existing) {
        return res.status(409).json({ error: 'Ce pseudo est déjà pris' });
    }

    // Hash du mot de passe (SHA-256 + salt serveur)
    const salt = process.env.AUTH_SALT ?? 'sckt_default_salt_change_me';
    const hash = crypto.createHash('sha256').update(password + salt).digest('hex');

    // Stockage utilisateur
    await kv.set(key, { pseudo: normalizedPseudo, hash, createdAt: Date.now() });

    // Génération du token de session (7 jours)
    const token = crypto.randomBytes(32).toString('hex');
    await kv.set(`token:${token}`, normalizedPseudo, { ex: 604800 });

    return res.status(200).json({ token, pseudo: normalizedPseudo });
}
