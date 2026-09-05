import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Hls from 'hls.js'

export default function LiveWatch() {
  const navigate = useNavigate()
  const location = useLocation()

  const videoRef = useRef(null)
  const touchStartY = useRef(null)
  const touchStartX = useRef(null)
  const hlsRef = useRef(null)
  const changingStream = useRef(false)

  const state = location.state || {}

  const models = Array.isArray(state.models)
    ? state.models
    : []

  const initialIndex =
    typeof state.index === 'number'
      ? state.index
      : 0

  const [currentIndex, setCurrentIndex] = useState(initialIndex)

  const currentModel = models[currentIndex] || state

  const title = currentModel?.title
  const image = currentModel?.image
  const video = currentModel?.video

  /*
   * Load HLS stream
   */
  const loadStream = useCallback((streamUrl) => {
    const videoElement = videoRef.current

    if (!videoElement || !streamUrl) return

    // Destroy previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    videoElement.pause()
    videoElement.removeAttribute('src')
    videoElement.load()

    changingStream.current = true

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      })

      hlsRef.current = hls

      hls.loadSource(streamUrl)
      hls.attachMedia(videoElement)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoElement.play().catch(() => {})
        changingStream.current = false
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('HLS error:', data)

        if (data?.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Trying to recover HLS network error...')
              hls.startLoad()
              break

            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Trying to recover HLS media error...')
              hls.recoverMediaError()
              break

            default:
              hls.destroy()
              hlsRef.current = null
              break
          }
        }
      })
    } else if (
      videoElement.canPlayType(
        'application/vnd.apple.mpegurl'
      )
    ) {
      videoElement.src = streamUrl

      const playVideo = () => {
        videoElement.play().catch(() => {})
        changingStream.current = false
      }

      videoElement.addEventListener(
        'loadedmetadata',
        playVideo,
        { once: true }
      )
    } else {
      changingStream.current = false
      console.error('HLS is not supported by this browser.')
    }
  }, [])

  /*
   * Load current live stream
   */
  useEffect(() => {
    if (!video) return

    loadStream(video)

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
    }
  }, [video, loadStream])

  /*
   * Go to next live stream
   */
  const nextLive = useCallback(() => {
    if (!models.length) return

    if (currentIndex >= models.length - 1) {
      return
    }

    const nextIndex = currentIndex + 1

    setCurrentIndex(nextIndex)
  }, [currentIndex, models.length])

  /*
   * Go to previous live stream
   */
  const previousLive = useCallback(() => {
    if (!models.length) return

    if (currentIndex <= 0) {
      return
    }

    const previousIndex = currentIndex - 1

    setCurrentIndex(previousIndex)
  }, [currentIndex, models.length])

  /*
   * Touch swipe
   */
  const handleTouchStart = (e) => {
    const touch = e.touches[0]

    touchStartY.current = touch.clientY
    touchStartX.current = touch.clientX
  }

  const handleTouchEnd = (e) => {
    if (
      touchStartY.current === null ||
      touchStartX.current === null
    ) {
      return
    }

    const touch = e.changedTouches[0]

    const deltaY =
      touch.clientY - touchStartY.current

    const deltaX =
      touch.clientX - touchStartX.current

    touchStartY.current = null
    touchStartX.current = null

    // Ignore mostly-horizontal swipes
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return
    }

    // Minimum swipe distance
    if (Math.abs(deltaY) < 60) {
      return
    }

    if (deltaY < 0) {
      // Swipe UP = next live
      nextLive()
    } else {
      // Swipe DOWN = previous live
      previousLive()
    }
  }

  /*
   * Keyboard navigation
   */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowUp') {
        previousLive()
      }

      if (e.key === 'ArrowDown') {
        nextLive()
      }

      if (e.key === 'Escape') {
        navigate('/live')
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [nextLive, previousLive, navigate])

  /*
   * Fullscreen only the video player
   */
  const toggleFullscreen = async () => {
    const videoElement = videoRef.current

    if (!videoElement) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      if (videoElement.requestFullscreen) {
        await videoElement.requestFullscreen()
        return
      }

      // iPhone / Safari
      if (videoElement.webkitEnterFullscreen) {
        videoElement.webkitEnterFullscreen()
      }
    } catch (error) {
      console.error(
        'Fullscreen error:',
        error
      )
    }
  }

  /*
   * Prevent browser image/video dragging
   */
  const preventDrag = (e) => {
    e.preventDefault()
  }

  /*
   * No stream selected
   */
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
    <main
      className="live-watch-page"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <header className="live-watch-header">
        <button
          onClick={() => navigate('/live')}
          className="back-btn"
        >
          ←
        </button>

        <h1>
          {title || 'Live'}
        </h1>
      </header>

      <div className="live-player">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          poster={image}
          controls
          preload="auto"
          onDragStart={preventDrag}
          onContextMenu={(e) => e.preventDefault()}
        />

        <div className="live-player-controls">
          <button
            type="button"
            onClick={toggleFullscreen}
            className="fullscreen-btn"
          >
            ⛶
          </button>
        </div>
      </div>

      <div className="live-watch-info">
        <h2>
          {title || 'Live'}
        </h2>

        <span>
          🔴 LIVE
        </span>
      </div>

      {models.length > 1 && (
        <div className="live-position">
          {currentIndex + 1} / {models.length}
        </div>
      )}
    </main>
  )
}

