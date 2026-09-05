export default async function handler(req, res) {
  const apiUrl =
    'https://xhamsterlive.com/api/front/models?removeShows=true&recInFeatured=false&limit=99&offset=0&primaryTag=girls&filterGroupTags=%5B%5B%22ethnicityIndian%22%5D%5D&sortBy=stripRanking&parentTag=ethnicityIndian&nic=true&byw=false&rcmGrp=A&rbCnGr=true&iem=true&mvPrm=false&decMb=false&ctryTop=false&guestHash=03fbccd27afa58c95f00db7639ba92220394f57bfb4b5f1244bed488b4f25f15&mlfv=false&uniq=ulad7x84vzi6gjew';

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      return res.status(response.status).json({
        error: `External API returned HTTP ${response.status}`,
      });
    }

    const data = await response.json();

    res.setHeader(
      'Cache-Control',
      's-maxage=30, stale-while-revalidate=60'
    );

    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({
      error: error.message || 'Unable to load external live data',
    });
  }
}
