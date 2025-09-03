
import type { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const n8nUrl = process.env.N8N_WEBHOOK_URL;

  // --- این بخش اضافه شده است ---
  // اول بررسی می‌کنیم که آیا متغیر محیطی اصلاً وجود دارد یا نه
  if (!n8nUrl) {
    console.error('FATAL: N8N_WEBHOOK_URL environment variable is not set.');
    return res.status(500).send('Internal Server Error: Webhook URL is not configured.');
  }
  // ------------------------------

  console.log(`Forwarding to n8n: ${n8nUrl}`);

  try {
    const response = await fetch(n8nUrl, { // حالا تایپ‌اسکریپت مطمئن است که n8nUrl یک رشته است
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    console.log(`n8n response: ${JSON.stringify(data)}`);

    if (!response.ok) {
      throw new Error(`n8n error: ${response.status}`);
    }

    res.status(200).json(data);
  } catch (error: any) {
    console.error(`Error details: ${error.message}`, error.stack);
    res.status(500).send('Internal Server Error');
  }
}
