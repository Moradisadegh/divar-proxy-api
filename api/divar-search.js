// api/divar-search.ts (بدون تغییر عمده، فقط برای کامل بودن)
import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { city = 'tehran', cat = '', q = '', min_price = '', max_price = '', max_age_h = '48', province = '' } = req.query;

  // Simple rate-limit: 1 min delay
  await new Promise(resolve => setTimeout(resolve, 60000));

  try {
    const searchUrl = `https://api.divar.ir/v8/search/${city}/${cat}`;
    const payload = {
      json_schema: {
        category: { value: cat },
        ...(q ? { query: q as string } : {}),
        ...(min_price || max_price ? { price: { min: parseInt(min_price as string) || undefined, max: parseInt(max_price as string) || undefined } } : {}),
      },
      page: 1,
    };

    const response = await fetch(searchUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; Pixel 3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.114 Mobile Safari/537.36',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) throw new Error(`Divar API error: ${response.status}`);

    const data = await response.json();

    if (data.widget_list && data.widget_list.some((w: any) => w.widget_type === 'BLOCKING_VIEW')) {
      throw new Error('BLOCKING_VIEW detected: ممکن است نیاز به بروزرسانی یا User-Agent متفاوت باشد. شهر/دسته را چک کنید.');
    }

    const postList = data.web_widgets?.post_list || data.widget_list || [];
    const now = Math.floor(Date.now() / 1000);
    const maxAgeSec = parseInt(max_age_h as string) * 3600;

    const items = postList
      .filter((w: any) => {
        const postDate = w.data?.action_log?.date || w.data?.post_date;
        return postDate && postDate > now - maxAgeSec;
      })
      .map((w: any) => ({
        id: w.data.token || w.data.id,
        title: w.data.title,
        price: parseInt(w.data.price?.value || w.data.normal_text?.replace(/[^\d]/g, '') || '0'),
        city: w.data.city || city,
        posted_at: new Date((w.data.action_log?.date || w.data.post_date) * 1000).toISOString(),
        url: `https://divar.ir/v/${encodeURIComponent(w.data.title)}/${w.data.token}`,
      }));

    res.status(200).json({ provider: 'divar-proxy', ts: new Date().toISOString(), items });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
}
