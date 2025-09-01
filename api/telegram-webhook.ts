import { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    console.log('Invalid method:', req.method);
    return res.status(405).send('Method Not Allowed');
  }

  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  if (!n8nUrl) {
    console.error('N8N_WEBHOOK_URL not set');
    return res.status(500).send('N8N_WEBHOOK_URL not set');
  }

  console.log('Forwarding to n8n:', n8nUrl); // Log for debugging

  try {
    const response = await fetch(n8nUrl, {
      method: 'POST',
      body: JSON.stringify(req.body),
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`n8n responded with ${response.status}: ${errorText}`);
      throw new Error(`n8n error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Error forwarding to n8n:', error);
    res.status(500).send(error.message);
  }
}
