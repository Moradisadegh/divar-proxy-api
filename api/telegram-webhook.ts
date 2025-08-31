// api/telegram-webhook.ts (برای دریافت webhook از تلگرام و فوروارد به n8n)
import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL; // ست کنید در Vercel Env: https://your-n8n-server.com/divar-telegram-webhook
  if (!N8N_WEBHOOK_URL) return res.status(500).json({ error: 'N8N_WEBHOOK_URL not set' });

  try {
    // فوروارد body مستقیم به n8n
    const response = await fetch(N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) throw new Error(`n8n error: ${response.status}`);

    res.status(200).json({ status: 'forwarded' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
}
