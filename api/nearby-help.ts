export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY is not configured.' });
  }

  const { lat, lng } = req.query;
  if (!lat || !lng) {
    return res.status(400).json({ error: 'Missing lat or lng' });
  }

  try {
    const response = await fetch('https://places.googleapis.com/v1/places:searchNearby', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.formattedAddress'
      },
      body: JSON.stringify({
        includedTypes: ['police', 'fire_station'],
        maxResultCount: 10,
        rankPreference: 'DISTANCE',
        locationRestriction: {
          "circle": {
            "center": {
              "latitude": parseFloat(lat as string),
              "longitude": parseFloat(lng as string)
            },
            "radius": 10000.0
          }
        }
      })
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Places API Error:', text);
      return res.status(500).json({ error: 'Failed to fetch nearby places' });
    }

    const data = await response.json();
    return res.status(200).json({ places: data.places || [] });
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
}
