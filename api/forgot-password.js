import { Redis } from '@upstash/redis';
import crypto from 'crypto';

const redis = new Redis({
    url:   process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_URL,
    token: process.env.UPSTASH_REDIS_KV_REST_API__KV_REST_API_TOKEN,
});

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).end();

    const { email } = req.body ?? {};
    if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email requis' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Toujours répondre OK pour ne pas révéler si l'email existe
    const pseudo = await redis.get(`email:${normalizedEmail}`);
    if (!pseudo) return res.status(200).json({ ok: true });

    const token = crypto.randomBytes(32).toString('hex');
    await redis.set(`reset:${token}`, pseudo, { ex: 3600 }); // 1 heure

    const baseUrl = process.env.SITE_URL ?? 'https://supercanvasknight.com';
    const resetUrl = `${baseUrl}/?reset=${token}`;

    await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            from: 'Super Canvas Knight <noreply@supercanvasknight.com>',
            to: normalizedEmail,
            subject: '🔑 Réinitialisation de ton mot de passe',
            html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0e1a;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:480px;margin:40px auto;background:#0e1320;border:1px solid rgba(100,140,255,0.2);border-radius:16px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#1a0505,#1a1020);padding:28px 32px;text-align:center;border-bottom:1px solid rgba(255,60,60,0.15);">
      <div style="font-size:36px;margin-bottom:8px;">⚔️</div>
      <div style="color:#FBD000;font-size:22px;font-weight:800;letter-spacing:2px;">SUPER CANVAS KNIGHT</div>
    </div>
    <div style="padding:32px;color:#c8d8f0;">
      <h2 style="margin:0 0 16px;color:#e0e8ff;font-size:20px;">Réinitialisation du mot de passe</h2>
      <p style="margin:0 0 8px;color:#8aaad8;">Bonjour <strong style="color:#c8dcff">${pseudo}</strong>,</p>
      <p style="margin:0 0 24px;color:#8aaad8;line-height:1.6;">
        Tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe.
        Ce lien est valable <strong style="color:#c8dcff">1 heure</strong>.
      </p>
      <div style="text-align:center;margin:28px 0;">
        <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#8b0000,#c0392b);color:#fff;text-decoration:none;border-radius:10px;font-weight:800;font-size:16px;letter-spacing:1px;">
          🔑 Réinitialiser mon mot de passe
        </a>
      </div>
      <p style="margin:0;color:#3a5570;font-size:12px;line-height:1.5;">
        Si tu n'as pas demandé cette réinitialisation, ignore ce message. Ton mot de passe ne sera pas modifié.<br><br>
        Lien valable jusqu'à : ${new Date(Date.now() + 3600000).toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })}
      </p>
    </div>
  </div>
</body>
</html>`,
        }),
    });

    return res.status(200).json({ ok: true });
}
