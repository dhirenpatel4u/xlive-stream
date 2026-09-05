export default async function handler(req, res) {
  const apiUrl =
    'https://xhamsterlive.com/api/front/models?removeShows=true&recInFeatured=false&limit=99&offset=0&primaryTag=girls&filterGroupTags=%5B%5B%22ethnicityIndian%22%5D%5D&sortBy=stripRanking&parentTag=ethnicityIndian&nic=true&byw=false&rcmGrp=A&rbCnGr=true&iem=true&mvPrm=false&decMb=false&ctryTop=false&guestHash=03fbccd27afa58c95f00db7639ba92220394f57bfb4b5f1244bed488b4f25f15&mlfv=false&uniq=ulad7x84vzi6gjew'

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
    })

    if (!response.ok) {
      return res.status(response.status).json({
        error: `External API returned HTTP ${response.status}`,
      })
    }

    const data = await response.json()

    const source = Array.isArray(data)
      ? data
      : Array.isArray(data.models)
        ? data.models
        : []

    const output = []

    for (const model of source) {
      const id = model.id
      const timestamp = model.popularSnapshotTimestamp
      const username = model.username

      if (!id || !timestamp) {
        continue
      }

      if (
        model.status &&
        String(model.status).toLowerCase() !== 'public'
      ) {
        continue
      }

      output.push({
        title: username || model.name || 'Live model',

        image:
          `https://img.doppiocdn.org/thumbs/${timestamp}/${id}_webp`,

        video:
          `https://media-hls.growcdnssedge.com/b-hls-28/${id}/${id}.m3u8`,
      })
    }

    res.setHeader(
      'Cache-Control',
      's-maxage=30, stale-while-revalidate=60'
    )

    return res.status(200).json(output)
  } catch (error) {
    console.error('Live API error:', error)

    return res.status(500).json({
      error: error.message || 'Unable to load external live data',
    })
  }
}
