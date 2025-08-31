// File: /api/divar-search.js

export default async function handler(request, response) {
  // ... (headers and CORS handling remain the same) ...
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // Use request.body for POST requests (from n8n) and request.query for GET (for testing)
  const params = request.method === 'POST' ? request.body : request.query;
  const { city, cat, q, min_price, max_price, max_age_h } = params;

  if (!city && !q) {
    return response.status(400).json({
      error: 'Bad Request: At least "city" or "q" query parameter is required.',
    });
  }

  const divarApiUrl = `https://api.divar.ir/v8/web-search/${city || 'tehran'}/${cat || ''}`;
  const requestBody = {
    json_schema: {
      query: q || '',
      ...(min_price && { price: { min: parseInt(min_price, 10) } }),
      ...(max_price && { price: { ...((min_price && { min: parseInt(min_price, 10) }) || {}), max: parseInt(max_price, 10) } }),
    },
    "last-post-date": new Date().getTime() * 1000,
  };

  try {
    const apiResponse = await fetch(divarApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await apiResponse.json();

    // --- START OF CHANGE ---
    // **CRITICAL CHECK**: Verify the response structure from Divar before processing.
    // If 'web_widgets' doesn't exist, it means Divar returned an error or an unexpected format.
    if (!data || !data.web_widgets || !data.web_widgets.post_list) {
      console.error('Unexpected Divar API response structure:', JSON.stringify(data, null, 2));
      // Return a structured error to n8n for easier debugging.
      return response.status(502).json({
        error: 'Bad Gateway: Unexpected response from Divar API.',
        message: "The response from Divar did not contain 'web_widgets.post_list'. This might be due to an invalid city slug or other API errors.",
        divar_response: data, // Include the actual response from Divar for debugging.
        sent_payload: requestBody,
      });
    }
    // --- END OF CHANGE ---

    const items = data.web_widgets.post_list
      .filter(item => item.widget_type === 'POST_ROW')
      .map(item => item.data);

    let standardizedItems = items.map(item => ({
      id: item.action.payload.token,
      title: item.title,
      price: item.action?.payload?.web_info?.price || 0, // Safer access to price
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
      source: 'Vercel Proxy (v2)',
    });

  } catch (error) {
    console.error('Error in Vercel function:', error);
    response.status(500).json({
      error: 'Internal Server Error in Vercel Function',
      message: error.message,
    });
  }
}
