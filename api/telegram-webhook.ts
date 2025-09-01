import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const n8nUrl = process.env.N8N_WEBHOOK_URL; // e.g., https://mykasbai.ir/n8n/webhook/divar-telegram-webhook
  console.log(`Forwarding to n8n: ${n8nUrl}`); // Log URL for debugging

  try {
    const response = await fetch(n8nUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    console.log(`n8n response: ${JSON.stringify(data)}`); // Log full response

    if (!response.ok) {
      throw new Error(`n8n error: ${response.status}`);
    }

    res.status(200).json(data);
  } catch (error) {
    console.error(`Error details: ${error.message}`, error.stack);
    res.status(500).send('Internal Server Error');
  }
}
