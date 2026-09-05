import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Hls from 'hls.js'

export default function LiveWatch() {
  const navigate = useNavigate()
  const location = useLocation()

  const videoRef = useRef(null)

  const { title, image, video } = location.state || {}

  useEffect(() => {
    if (!video || !videoRef.current) return

    const videoElement = videoRef.current

    let hls

    if (Hls.isSupported()) {
      hls = new Hls()

      hls.loadSource(video)
      hls.attachMedia(videoElement)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoElement.play().catch(() => {})
      })
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      videoElement.src = video

      videoElement.addEventListener('loadedmetadata', () => {
        videoElement.play().catch(() => {})
      })
    }

    return () => {
      if (hls) {
        hls.destroy()
      }
    }
  }, [video])

  if (!video) {
    return (
      <main className="live-watch-page">
        <button
          onClick={() => navigate('/live')}
          className="back-btn"
        >
          ← Back
        </button>

        <p>Live stream not found.</p>
      </main>
    )
  }

  return (
    <main className="live-watch-page">
      <header className="live-watch-header">
        <button
          onClick={() => navigate('/live')}
          className="back-btn"
        >
          ←
        </button>

        <h1>{title || 'Live'}</h1>
      </header>

      <div className="live-player">
        <video
          ref={videoRef}
          controls
          autoPlay
          playsInline
          poster={image}
        />
      </div>

      <div className="live-watch-info">
        <h2>{title || 'Live'}</h2>
        <span>🔴 LIVE</span>
      </div>
    </main>
  )
}
