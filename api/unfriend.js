import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();
    const { token, target } = req.body;
    if (!token || !target) return res.status(400).json({ error: 'Paramètres manquants' });
    const pseudo = await kv.get(`token:${token}`);
    if (!pseudo) return res.status(401).json({ error: 'Non authentifié' });
    // Supprimer dans les deux sens
    await kv.lrem(`friends:${pseudo}`, 0, target);
    await kv.lrem(`friends:${target}`, 0, pseudo);
    res.status(200).json({ ok: true });
}
