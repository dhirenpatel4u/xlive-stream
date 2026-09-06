import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

function shuffle(array) {
const result = [...array]

for (let i = result.length - 1; i > 0; i--) {
const j = Math.floor(
Math.random() * (i + 1)
)

;[result[i], result[j]] = [
  result[j],
  result[i]
]

}

return result
}

export default function Share() {
const location = useLocation()
const navigate = useNavigate()

const [videos, setVideos] = useState([])
const [current, setCurrent] = useState(null)
const [randomVideos, setRandomVideos] =
useState([])

const [loading, setLoading] =
useState(true)

const [error, setError] =
useState('')

// ================================================
// LOAD VIDEOS
// ================================================

useEffect(() => {
let cancelled = false

const params =
  new URLSearchParams(
    location.search
  )

const reel =
  params.get('reel')

if (!reel) {
  setError('Video not found.')
  setLoading(false)
  return
}

let decodedReel = reel

try {
  decodedReel =
    decodeURIComponent(reel)
} catch {}

fetch('/data/videos.json', {
  cache: 'no-store'
})
  .then((response) => {
    if (!response.ok) {
      throw new Error(
        'Unable to load videos.'
      )
    }

    return response.json()
  })
  .then((data) => {
    if (cancelled) return

    const list =
      Array.isArray(data)
        ? data
        : []

    setVideos(list)

    const found =
      list.find(
        (video) =>
          (
            video.title || ''
          )
            .trim()
            .toLowerCase() ===
          decodedReel
            .trim()
            .toLowerCase()
      )

    if (!found) {
      setError(
        'Video not found.'
      )

      setLoading(false)

      return
    }

    setCurrent(found)

    // --------------------------------------------
    // RANDOM VIDEOS
    //
    // Remove current video and shuffle the rest.
    // --------------------------------------------

    const others =
      list.filter(
        (video) =>
          video.video !==
          found.video
      )

    setRandomVideos(
      shuffle(others)
    )

    setLoading(false)
  })
  .catch((err) => {
    if (cancelled) return

    setError(
      err.message ||
        'Unable to load video.'
    )

    setLoading(false)
  })

return () => {
  cancelled = true
}

}, [location.search])

// ================================================
// OPEN VIDEO IN REELS
// ================================================

const openReel = (video) => {
if (!video?.title) return

navigate(
  `/?reel=${encodeURIComponent(
    video.title
  )}`
)

}

// ================================================
// LOADING
// ================================================

if (loading) {
return (
<main className="share-page">

    <div className="share-loading">
      Loading video...
    </div>

  </main>
)

}

// ================================================
// ERROR
// ================================================

if (error || !current) {
return (
<main className="share-page">

    <div className="share-error">

      <h1>
        Video unavailable
      </h1>

      <p>
        {error ||
          'This video could not be found.'}
      </p>

      <button
        onClick={() =>
          navigate('/')
        }
      >
        Browse Videos
      </button>

    </div>

  </main>
)

}

// ================================================
// SHARE PAGE
// ================================================

return (
<main className="share-page">

  {/* ============================================
      MAIN SHARED VIDEO
  ============================================ */}

  <section className="share-main-video">

    <video
      src={current.video}
      controls
      playsInline
      preload="metadata"
      poster={current.image || undefined}
    />

  </section>


  {/* ============================================
      VIDEO DETAILS
  ============================================ */}

  <section className="share-video-details">

    <h1>
      {current.title}
    </h1>

    <button
      className="share-open-button"
      onClick={() =>
        openReel(current)
      }
    >
      Watch Fullscreen
    </button>

  </section>


  {/* ============================================
      RANDOM VIDEOS
  ============================================ */}

  {randomVideos.length > 0 && (

    <section className="share-random-section">

      <h2>
        More Videos
      </h2>

      <div className="share-video-grid">

        {randomVideos.map(
          (video, index) => (

            <button
              key={
                `${video.video}-${index}`
              }
              className="share-video-card"
              onClick={() =>
                openReel(video)
              }
            >

              {video.image ? (

                <img
                  src={video.image}
                  alt={
                    video.title || ''
                  }
                  loading="lazy"
                />

              ) : (

                <div className="share-no-image">
                  Video
                </div>

              )}

              <div className="share-video-title">
                {video.title}
              </div>

            </button>

          )
        )}

      </div>

    </section>

  )}

</main>

)
}
