import { NextApiRequest, NextApiResponse } from 'next'; 
import fetch from 'node-fetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) { // <--- و اینجا
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }

  const n8nUrl = process.env.N8N_WEBHOOK_URL;
  console.log(`Forwarding to n8n: ${n8nUrl}`);

  try {
    const response = await fetch(n8nUrl, {
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
  } catch (error) {
    console.error(`Error details: ${error.message}`, error.stack);
    res.status(500).send('Internal Server Error');
  }
}

