```jsx
import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Hls from 'hls.js'

export default function LiveWatch() {
  const navigate = useNavigate()
  const location = useLocation()

  const videoRef = useRef(null)
  const hlsRef = useRef(null)

  const touchStartY = useRef(null)
  const touchStartX = useRef(null)

  const state = location.state || {}

  const models = Array.isArray(state.models)
    ? state.models
    : []

  const initialIndex =
    typeof state.index === 'number'
      ? state.index
      : 0

  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  const currentModel = models[currentIndex] || state

  const title = currentModel?.title
  const image = currentModel?.image
  const video = currentModel?.video

  /* =========================
     LOAD HLS STREAM
  ========================= */

  const loadStream = useCallback((streamUrl) => {
    const videoElement = videoRef.current

    if (!videoElement || !streamUrl) return

    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }

    videoElement.pause()
    videoElement.removeAttribute('src')
    videoElement.load()

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
      })

      hlsRef.current = hls

      hls.loadSource(streamUrl)
      hls.attachMedia(videoElement)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoElement.muted = isMuted

        videoElement.play().catch(() => {})
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.error('HLS error:', data)

        if (!data?.fatal) return

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hls.startLoad()
            break

          case Hls.ErrorTypes.MEDIA_ERROR:
            hls.recoverMediaError()
            break

          default:
            hls.destroy()
            hlsRef.current = null
            break
        }
      })
    } else if (
      videoElement.canPlayType(
        'application/vnd.apple.mpegurl'
      )
    ) {
      videoElement.src = streamUrl
      videoElement.muted = isMuted

      videoElement.addEventListener(
        'loadedmetadata',
        () => {
          videoElement.play().catch(() => {})
        },
        { once: true }
      )
    } else {
      console.error(
        'HLS is not supported by this browser.'
      )
    }
  }, [isMuted])

  /* =========================
     LOAD CURRENT STREAM
  ========================= */

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

  /* =========================
     MUTE / UNMUTE
  ========================= */

  const toggleMute = () => {
    const videoElement = videoRef.current

    if (!videoElement) return

    const newMutedState = !videoElement.muted

    videoElement.muted = newMutedState

    setIsMuted(newMutedState)
  }

  /* =========================
     FULLSCREEN
  ========================= */

  const toggleFullscreen = async () => {
    const videoElement = videoRef.current

    if (!videoElement) return

    try {
      if (
        document.fullscreenElement ||
        document.webkitFullscreenElement
      ) {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
          document.webkitExitFullscreen()
        }

        return
      }

      if (videoElement.requestFullscreen) {
        await videoElement.requestFullscreen()
        return
      }

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

  /* =========================
     FULLSCREEN STATE
  ========================= */

  useEffect(() => {
    const handleFullscreenChange = () => {
      const fullscreen =
        !!document.fullscreenElement ||
        !!document.webkitFullscreenElement

      setIsFullscreen(fullscreen)

      if (videoRef.current) {
        videoRef.current.controls = fullscreen
      }
    }

    document.addEventListener(
      'fullscreenchange',
      handleFullscreenChange
    )

    document.addEventListener(
      'webkitfullscreenchange',
      handleFullscreenChange
    )

    return () => {
      document.removeEventListener(
        'fullscreenchange',
        handleFullscreenChange
      )

      document.removeEventListener(
        'webkitfullscreenchange',
        handleFullscreenChange
      )
    }
  }, [])

  /* =========================
     NEXT LIVE
  ========================= */

  const nextLive = useCallback(() => {
    if (!models.length) return

    if (currentIndex >= models.length - 1) {
      return
    }

    setCurrentIndex(currentIndex + 1)
  }, [currentIndex, models.length])

  /* =========================
     PREVIOUS LIVE
  ========================= */

  const previousLive = useCallback(() => {
    if (!models.length) return

    if (currentIndex <= 0) {
      return
    }

    setCurrentIndex(currentIndex - 1)
  }, [currentIndex, models.length])

  /* =========================
     SWIPE
  ========================= */

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

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      return
    }

    if (Math.abs(deltaY) < 60) {
      return
    }

    if (deltaY < 0) {
      nextLive()
    } else {
      previousLive()
    }
  }

  /* =========================
     KEYBOARD
  ========================= */

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

    window.addEventListener(
      'keydown',
      handleKeyDown
    )

    return () => {
      window.removeEventListener(
        'keydown',
        handleKeyDown
      )
    }
  }, [
    nextLive,
    previousLive,
    navigate,
  ])

  /* =========================
     NO STREAM
  ========================= */

  if (!video) {
    return (
      <main className="live-watch-page">
        <button
          onClick={() => navigate('/live')}
          className="back-btn"
        >
          ←
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

      {/* =========================
          HEADER
      ========================= */}

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

      {/* =========================
          PLAYER
      ========================= */}

      <div className="live-player">

        <video
          ref={videoRef}
          autoPlay
          playsInline
          poster={image}
          preload="auto"
          controls={isFullscreen}
          muted={isMuted}
          onContextMenu={(e) =>
            e.preventDefault()
          }
          onDragStart={(e) =>
            e.preventDefault()
          }
        />

        {/* =========================
            MUTE BUTTON
        ========================= */}

        <button
          type="button"
          className="live-mute-btn"
          onClick={toggleMute}
          aria-label={
            isMuted
              ? 'Unmute'
              : 'Mute'
          }
        >
          {isMuted ? '🔇' : '🔊'}
        </button>

        {/* =========================
            FULLSCREEN BUTTON
        ========================= */}

        <button
          type="button"
          className="live-fullscreen-btn"
          onClick={toggleFullscreen}
          aria-label={
            isFullscreen
              ? 'Exit fullscreen'
              : 'Fullscreen'
          }
        >
          {isFullscreen ? '⛶' : '⛶'}
        </button>

      </div>

      {/* =========================
          INFO
      ========================= */}

      <div className="live-watch-info">

        <h2>
          {title || 'Live'}
        </h2>

        <span>
          🔴 LIVE
        </span>

      </div>

      {/* =========================
          POSITION
      ========================= */}

      {models.length > 1 && (
        <div className="live-position">
          {currentIndex + 1} / {models.length}
        </div>
      )}

    </main>
  )
}
```
