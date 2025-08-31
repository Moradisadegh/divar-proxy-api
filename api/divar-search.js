// File: /api/divar-search.js

export default async function handler(request, response) {
  // CORS Headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-device-id'); // Allow device-id header

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  const params = request.method === 'POST' ? request.body : request.query;
  const { city, cat, q, min_price, max_price, max_age_h } = params;

  if (!city && !q) {
    return response.status(400).json({
      error: 'Bad Request: At least "city" or "q" query parameter is required.',
    });
  }

  const divarApiUrl = `https://api.divar.ir/v8/web-search/${city || 'tehran'}/${cat || ''}`;

  // --- START OF PAYLOAD CHANGE ---
  // **CRITICAL FIX**: Replicating the structure sent by Divar's website.
  // 1. Added 'page: 1' which seems to be mandatory.
  // 2. Removed 'last-post-date' as it might be causing issues.
  const requestBody = {
    "page": 1, // Add page parameter
    "json_schema": {
      "query": q || '',
      ...(min_price && { "price": { "min": parseInt(min_price, 10) } }),
      ...(max_price && { "price": { ...((min_price && { "min": parseInt(min_price, 10) }) || {}), "max": parseInt(max_price, 10) } }),
    },
  };
  // --- END OF PAYLOAD CHANGE ---

  try {
    const apiResponse = await fetch(divarApiUrl, {
      method: 'POST',
      // --- START OF HEADER CHANGE ---
      // Adding more headers to better simulate a real browser request
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36',
        'x-device-id': 'browser-e3c54433-22db-4c59-a68f-933333333333' // A random but valid-looking device ID
      },
      // --- END OF HEADER CHANGE ---
      body: JSON.stringify(requestBody),
    });

    const data = await apiResponse.json();

    if (!data || !data.web_widgets || !data.web_widgets.post_list) {
      console.error('Unexpected Divar API response structure:', JSON.stringify(data, null, 2));
      return response.status(502).json({
        error: 'Bad Gateway: Unexpected response from Divar API.',
        message: "The response from Divar did not contain 'web_widgets.post_list'. This might be due to an invalid city slug or other API errors.",
        divar_response: data,
        sent_payload: requestBody,
      });
    }

    const items = data.web_widgets.post_list
      .filter(item => item.widget_type === 'POST_ROW')
      .map(item => item.data);

    let standardizedItems = items.map(item => ({
      id: item.action.payload.token,
      title: item.title,
      price: item.action?.payload?.web_info?.price || 0,
      city: item.action?.payload?.web_info?.city_persian,
      district: item.action?.payload?.web_info?.district_persian,
      posted_at: new Date(parseInt(item.action.payload.token.substring(0, 13))),
      url: `https://divar.ir/v/${item.action.payload.token}`,
    }));
      
    if (max_age_h) {
        const maxAgeDate = new Date(Date.now() - parseInt(max_age_h, 10) * 3600 * 1000);
        standardizedItems = standardizedItems.filter(item => item.posted_at >= maxAgeDate);
    }

    response.status(200).json({
      items: standardizedItems,
      query: params,
      count: standardizedItems.length,
      source: 'Vercel Proxy (v4 - full headers)',
    });

  } catch (error) {
    console.error('Error in Vercel function:', error);
    response.status(500).json({
      error: 'Internal Server Error in Vercel Function',
      message: error.message,
    });
  }
}
