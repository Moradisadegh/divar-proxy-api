// api/send-telegram.ts (برای ارسال پیام به تلگرام از n8n)
import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const RELAY_KEY = process.env.RELAY_KEY; // ست کنید در Vercel Env
  if (req.headers['x-relay-key'] !== RELAY_KEY) return res.status(401).json({ error: 'Unauthorized' });

  const { chat_id, text, parse_mode = 'HTML' } = req.body;
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN; // ست کنید در Vercel Env
  if (!BOT_TOKEN) return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN not set' });

  try {
    const telegramUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const response = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id, text, parse_mode }),
    });

    if (!response.ok) throw new Error(`Telegram error: ${response.status}`);

    res.status(200).json({ status: 'sent' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
}
