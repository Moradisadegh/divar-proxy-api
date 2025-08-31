// File: /api/divar-search.js

/**
 * Vercel Serverless Function to act as a proxy for Divar's search API.
 * It takes search parameters from the query string, fetches data from Divar,
 * standardizes the output, and returns it as JSON.
 *
 * How to call:
 * https://<your-vercel-app-url>/api/divar-search?city=tehran&q=macbook%20pro
 */
export default async function handler(request, response) {
  // 1. Set CORS headers to allow requests from any origin (useful for testing)
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle pre-flight OPTIONS requests for CORS
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  // 2. Extract query parameters from the incoming request URL
  const { city, cat, q, min_price, max_price, max_age_h } = request.query;

  // At least city or query must be present
  if (!city && !q) {
    return response.status(400).json({
      error: 'Bad Request: At least "city" or "q" query parameter is required.',
    });
  }

  // 3. Construct the Divar API URL
  // We use a known public endpoint for search.
  const divarApiUrl = `https://api.divar.ir/v8/web-search/${city || 'tehran'}/${cat || ''}`;

  // 4. Prepare the JSON payload for the POST request to Divar
  const requestBody = {
    json_schema: {
      query: q || '',
      ...(min_price && { price: { min: parseInt(min_price, 10) } }),
      ...(max_price && { price: { ...((min_price && { min: parseInt(min_price, 10) }) || {}), max: parseInt(max_price, 10) } }),
    },
    // The "last-post-date" is used for pagination, but we fetch the first page.
    "last-post-date": new Date().getTime() * 1000, 
  };
  
  // 5. Calculate max age in Unix timestamp (nanoseconds)
  let maxAgeTimestamp = 0;
  if (max_age_h && !isNaN(parseInt(max_age_h))) {
    const hoursInMilliseconds = parseInt(max_age_h) * 60 * 60 * 1000;
    maxAgeTimestamp = (new Date().getTime() - hoursInMilliseconds) * 1000;
  }

  try {
    // 6. Fetch data from Divar's API using a POST request
    const apiResponse = await fetch(divarApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Handle non-successful responses from Divar
    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      throw new Error(`Divar API responded with status ${apiResponse.status}: ${errorText}`);
    }

    const data = await apiResponse.json();

    // 7. Process and standardize the results
    const items = data.web_widgets.post_list
      .filter(item => item.widget_type === 'POST_ROW') // Filter only actual posts
      .map(item => item.data)
      .filter(item => !maxAgeTimestamp || item.action.payload.post_token.endsWith(String(Math.floor(maxAgeTimestamp / 1e9)))) // This is a trick to compare timestamps roughly
      .map(item => ({
        id: item.action.payload.token, // Unique token for each post
        title: item.title,
        price: item.action.payload.web_info.price, // Price is an integer
        city: item.action.payload.web_info.city_persian,
        district: item.action.payload.web_info.district_persian,
        posted_at: new Date(parseInt(item.action.payload.token.substring(0, 13))), // Extract timestamp from token
        url: `https://divar.ir/v/${item.action.payload.token}`,
      }));
      
    // Filter by max_age_h more accurately if provided
    let filteredItems = items;
    if (max_age_h) {
        const maxAgeDate = new Date(Date.now() - parseInt(max_age_h) * 3600 * 1000);
        filteredItems = items.filter(item => item.posted_at >= maxAgeDate);
    }


    // 8. Send the standardized data back to the n8n workflow
    response.status(200).json({
      items: filteredItems,
      query: request.query,
      count: filteredItems.length,
      source: 'Vercel Proxy',
    });

  } catch (error) {
    console.error('Error fetching from Divar:', error);
    response.status(500).json({
      error: 'Internal Server Error',
      message: error.message,
    });
  }
}
