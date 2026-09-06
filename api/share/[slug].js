export default async function handler(req, res) {
  try {
    const { slug } = req.query

    if (!slug) {
      return res.status(404).send('Video not found')
    }

    // Load videos.json from the deployed public folder
    const dataUrl =
      `https://${req.headers.host}/data/videos.json`

    const response = await fetch(dataUrl)

    if (!response.ok) {
      return res.status(500).send('Unable to load videos')
    }

    const videos = await response.json()

    if (!Array.isArray(videos)) {
      return res.status(500).send('Invalid video data')
    }

    // Find video using the last part of the "post" URL
    const video = videos.find((item) => {
      if (!item?.post) return false

      try {
        const url = new URL(item.post)
        const parts = url.pathname
          .split('/')
          .filter(Boolean)

        const itemSlug = parts[parts.length - 1]

        return itemSlug?.toLowerCase() ===
          String(slug).toLowerCase()
      } catch {
        return false
      }
    })

    if (!video) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <title>Video Not Found</title>
          </head>
          <body>
            <h1>Video Not Found</h1>
          </body>
        </html>
      `)
    }

    const host =
      req.headers['x-forwarded-host'] ||
      req.headers.host ||
      'xlive-stream.vercel.app'

    const protocol =
      req.headers['x-forwarded-proto'] || 'https'

    const shareUrl =
      `${protocol}://${host}/share/${encodeURIComponent(slug)}`

    const watchUrl =
      `${protocol}://${host}/?reel=${encodeURIComponent(video.title)}`

    const title =
      video.title || 'Watch Video'

    const description =
      `Watch ${title} on XLive`

    const image =
      video.image || ''

    // Escape HTML so title/image cannot break the generated page
    const escapeHtml = (value) =>
      String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')

    res.setHeader('Content-Type', 'text/html; charset=utf-8')
    res.setHeader(
      'Cache-Control',
      'public, s-maxage=300, stale-while-revalidate=600'
    )

    return res.status(200).send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">

  <title>${escapeHtml(title)}</title>

  <meta
    name="description"
    content="${escapeHtml(description)}"
  >

  <!-- Open Graph -->
  <meta property="og:type" content="video.other">
  <meta
    property="og:title"
    content="${escapeHtml(title)}"
  >
  <meta
    property="og:description"
    content="${escapeHtml(description)}"
  >
  <meta
    property="og:url"
    content="${escapeHtml(shareUrl)}"
  >
  <meta
    property="og:image"
    content="${escapeHtml(image)}"
  >
  <meta
    property="og:image:secure_url"
    content="${escapeHtml(image)}"
  >
  <meta property="og:image:type" content="image/webp">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <!-- Twitter -->
  <meta
    name="twitter:card"
    content="summary_large_image"
  >
  <meta
    name="twitter:title"
    content="${escapeHtml(title)}"
  >
  <meta
    name="twitter:description"
    content="${escapeHtml(description)}"
  >
  <meta
    name="twitter:image"
    content="${escapeHtml(image)}"
  >

  <meta
    http-equiv="refresh"
    content="0;url=${escapeHtml(watchUrl)}"
  >

  <script>
    window.location.replace(
      ${JSON.stringify(watchUrl)}
    )
  </script>
</head>

<body>
  <p>
    Opening video...
  </p>

  <p>
    <a href="${escapeHtml(watchUrl)}">
      Open Video
    </a>
  </p>
</body>
</html>
`)
}
