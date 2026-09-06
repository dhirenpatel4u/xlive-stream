import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ControlButton from '../components/ControlButton'
import { APP } from '../config'

const FITS = ['fit', 'fill', 'auto']
const SPEEDS = [1, 1.25, 1.5, 2]

function shuffle(array) {
  const result = [...array]

  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))

    ;[result[i], result[j]] = [result[j], result[i]]
  }

  return result
}

export default function Reels() {
  const location = useLocation()
  const navigate = useNavigate()

  const [videos, setVideos] = useState([])
  const [order, setOrder] = useState([])
  const [index, setIndex] = useState(0)

  const [muted, setMuted] = useState(true)
  const [fit, setFit] = useState('fit')
  const [speed, setSpeed] = useState(1)

  const [dataLoading, setDataLoading] = useState(true)
  const [videoLoading, setVideoLoading] = useState(false)
  const [error, setError] = useState('')

  const [progress, setProgress] = useState(0)
  const [flash, setFlash] = useState('')
  const [holdSpeedActive, setHoldSpeedActive] = useState(false)

  const videoRefs = useRef({})
  const preloadRefs = useRef({})

  const touchStart = useRef(null)
  const wheelLock = useRef(false)

  const holdTimer = useRef(null)
  const videoLoadingTimer = useRef(null)

  const wasPlayingBeforeHold = useRef(false)
  const longPressActive = useRef(false)
  const changingSpeed = useRef(false)

  const videoRequestId = useRef(0)

  const showFlash = useCallback((message) => {
    setFlash(message)

    window.clearTimeout(showFlash.timer)

    showFlash.timer = window.setTimeout(() => {
      setFlash('')
    }, 1600)
  }, [])

  /*
   * Load videos.json
   */
  useEffect(() => {
    let cancelled = false

    setDataLoading(true)
    setError('')

    fetch('/data/videos.json', {
      cache: 'no-store'
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error('Unable to load videos.')
        }

        return response.json()
      })
      .then((data) => {
        if (cancelled) return

        const list = Array.isArray(data)
          ? data.filter((item) => item?.video)
          : []

        if (!list.length) {
          throw new Error('No videos found.')
        }

        setVideos(list)

        /*
         * Check for:
         * /?reel=VIDEO_TITLE
         */
        const params = new URLSearchParams(location.search)
        const reelTitle = params.get('reel')

        let shuffled = shuffle(list)

        if (reelTitle) {
          let decodedTitle = reelTitle

          try {
            decodedTitle = decodeURIComponent(reelTitle)
          } catch {}

          const targetIndex = shuffled.findIndex(
            (video) =>
              (video.title || '').trim().toLowerCase() ===
              decodedTitle.trim().toLowerCase()
          )

          if (targetIndex !== -1) {
            const target = shuffled[targetIndex]

            shuffled = [
              target,
              ...shuffled.filter((_, i) => i !== targetIndex)
            ]
          }
        }

        setOrder(shuffled.map((_, i) => i))
        setIndex(0)
        setDataLoading(false)
      })
      .catch((err) => {
        if (cancelled) return

        setError(err.message || 'Unable to load videos.')
        setDataLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [location.search])

  /*
   * Current video
   */
  const currentVideoIndex = order[index]
  const current = videos[currentVideoIndex]

  /*
   * Navigation
   */
  const go = useCallback(
    (delta) => {
      if (!videos.length || !order.length) return

      window.clearTimeout(holdTimer.current)
      window.clearTimeout(videoLoadingTimer.current)

      videoRequestId.current += 1

      setError('')
      setVideoLoading(false)
      setProgress(0)

      setIndex((previous) => {
        let next = previous + delta

        if (next < 0) {
          next = order.length - 1
        }

        if (next >= order.length) {
          next = 0
        }

        return next
      })
    },
    [videos.length, order.length]
  )

  /*
   * Stop all videos except active video
   */
  useEffect(() => {
    Object.entries(videoRefs.current).forEach(([key, video]) => {
      if (!video) return

      if (Number(key) !== index) {
        video.pause()
      }
    })
  }, [index])

  /*
   * Setup active video
   */
  useEffect(() => {
    if (!current?.video) return

    const active = videoRefs.current[index]

    if (!active) return

    const requestId = ++videoRequestId.current

    window.clearTimeout(videoLoadingTimer.current)

    setError('')
    setProgress(0)
    setVideoLoading(false)

    active.muted = muted
    active.playbackRate = speed

    /*
     * Do not show spinner immediately.
     * Only show it if video is still not playing
     * after one second.
     */
    const showSpinner = () => {
      if (requestId !== videoRequestId.current) return

      if (
        active.paused ||
        active.readyState < 3
      ) {
        setVideoLoading(true)
      }
    }

    videoLoadingTimer.current =
      window.setTimeout(showSpinner, 1000)

    const playVideo = async () => {
      try {
        active.load()

        await active.play()

        if (requestId !== videoRequestId.current) return

        window.clearTimeout(videoLoadingTimer.current)
        setVideoLoading(false)
      } catch {
        if (requestId !== videoRequestId.current) return

        window.clearTimeout(videoLoadingTimer.current)

        if (active.readyState >= 2) {
          setVideoLoading(false)
        }
      }
    }

    playVideo()

    return () => {
      window.clearTimeout(videoLoadingTimer.current)
    }
  }, [current?.video, index, muted, speed])

  /*
   * Preload next two videos
   */
  useEffect(() => {
    if (!order.length || !videos.length) return

    const nextIndexes = []

    for (let i = 1; i <= 2; i++) {
      const nextPosition =
        (index + i) % order.length

      const videoIndex = order[nextPosition]

      if (
        videoIndex !== undefined &&
        videos[videoIndex]?.video
      ) {
        nextIndexes.push({
          position: nextPosition,
          video: videos[videoIndex]
        })
      }
    }

    /*
     * Remove preloaders that are no longer needed.
     */
    Object.keys(preloadRefs.current).forEach((key) => {
      if (
        !nextIndexes.some(
          (item) => String(item.position) === key
        )
      ) {
        const element = preloadRefs.current[key]

        try {
          element.pause()
          element.removeAttribute('src')
          element.load()
        } catch {}

        delete preloadRefs.current[key]
      }
    })

    /*
     * Create preload videos.
     */
    nextIndexes.forEach(({ position, video }) => {
      if (preloadRefs.current[position]) return

      const element = document.createElement('video')

      element.preload = 'auto'
      element.muted = true
      element.playsInline = true
      element.src = video.video

      element.addEventListener(
        'loadedmetadata',
        () => {
          try {
            element.currentTime = 0
          } catch {}
        },
        { once: true }
      )

      element.addEventListener(
        'progress',
        () => {
          /*
           * Encourage browser buffering.
           */
          try {
            if (
              element.buffered.length &&
              element.buffered.end(0) >= 5
            ) {
              element.pause()
            }
          } catch {}
        }
      )

      preloadRefs.current[position] = element

      try {
        element.load()
      } catch {}
    })

    return () => {
      /*
       * Keep preloaders alive between reel changes.
       */
    }
  }, [index, order, videos])

  /*
   * Mute
   */
  const toggleMute = () => {
    setMuted((value) => !value)
  }

  /*
   * Speed
   */
  const changeSpeed = () => {
    setSpeed((currentSpeed) => {
      const currentIndex = SPEEDS.indexOf(currentSpeed)

      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + 1) % SPEEDS.length

      const nextSpeed = SPEEDS[nextIndex]

      Object.values(videoRefs.current).forEach((video) => {
        if (video) {
          video.playbackRate = nextSpeed
        }
      })

      return nextSpeed
    })
  }

  /*
   * Long press = 2x speed
   */
  const startHoldSpeed = () => {
    if (changingSpeed.current) return

    longPressActive.current = false

    window.clearTimeout(holdTimer.current)

    holdTimer.current = window.setTimeout(() => {
      const active = videoRefs.current[index]

      if (!active) return

      longPressActive.current = true
      changingSpeed.current = true

      wasPlayingBeforeHold.current = !active.paused

      active.playbackRate = 2
      setHoldSpeedActive(true)

      if (!wasPlayingBeforeHold.current) {
        active.pause()
      }
    }, 450)
  }

  const stopHoldSpeed = () => {
    window.clearTimeout(holdTimer.current)

    if (!holdSpeedActive) {
      changingSpeed.current = false
      return
    }

    const active = videoRefs.current[index]

    if (active) {
      active.playbackRate = speed

      if (wasPlayingBeforeHold.current) {
        active.play().catch(() => {})
      }
    }

    setHoldSpeedActive(false)

    window.setTimeout(() => {
      changingSpeed.current = false
    }, 50)
  }

  /*
   * Progress
   */
  const handleTimeUpdate = (event) => {
    const video = event.currentTarget

    if (!video.duration) {
      setProgress(0)
      return
    }

    setProgress(
      (video.currentTime / video.duration) * 100
    )
  }

  /*
   * Seek
   */
  const seek = (event) => {
    event.stopPropagation()

    const active = videoRefs.current[index]

    if (!active || !active.duration) return

    const rect =
      event.currentTarget.getBoundingClientRect()

    const percentage =
      (event.clientX - rect.left) / rect.width

    active.currentTime =
      Math.max(
        0,
        Math.min(
          active.duration,
          active.duration * percentage
        )
      )
  }

  /*
   * Flash message
   */
  const flashMessage = (message) => {
    showFlash(message)
  }

  /*
   * Share
   *
   * Uses:
   * current.post
   *
   * Example:
   * https://viralmms.com/post/punjabi-kudi
   *
   * Creates:
   * https://xlive-stream.vercel.app/share/punjabi-kudi
   */
  const share = async () => {
    if (!current) return

    let slug = ''

    if (current.post) {
      try {
        const postUrl = new URL(current.post)

        const parts = postUrl.pathname
          .split('/')
          .filter(Boolean)

        slug = parts[parts.length - 1] || ''
      } catch {
        slug = ''
      }
    }

    /*
     * Fallback when post is missing.
     */
    if (!slug && current.title) {
      slug = current.title
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
    }

    if (!slug) {
      showFlash('Unable to create share link')
      return
    }

    const url =
      `${window.location.origin}/share/` +
      encodeURIComponent(slug)

    try {
      if (navigator.share) {
        await navigator.share({
          title: current.title || 'Watch Video',
          text: current.title || 'Watch Video',
          url
        })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url)
        showFlash('Link copied')
      } else {
        window.prompt(
          'Copy this link:',
          url
        )
      }
    } catch {
      /*
       * User cancelled native share.
       */
    }
  }

  /*
   * Download
   */
  const download = () => {
    if (!current?.download) {
      showFlash('Download unavailable')
      return
    }

    const link = document.createElement('a')

    link.href = current.download
    link.download = current.title || 'video'
    link.target = '_blank'
    link.rel = 'noopener noreferrer'

    document.body.appendChild(link)
    link.click()
    link.remove()
  }

  /*
   * Fullscreen
   */
  const fullscreen = async () => {
    const active = videoRefs.current[index]

    if (!active) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      if (active.requestFullscreen) {
        await active.requestFullscreen()
      } else if (active.webkitEnterFullscreen) {
        active.webkitEnterFullscreen()
      }
    } catch {}
  }

  /*
   * Change video fit
   */
  const changeFit = () => {
    setFit((currentFit) => {
      const currentIndex = FITS.indexOf(currentFit)

      const nextIndex =
        currentIndex === -1
          ? 0
          : (currentIndex + 1) % FITS.length

      return FITS[nextIndex]
    })
  }

  /*
   * Keyboard controls
   */
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.target?.tagName === 'INPUT' ||
        event.target?.tagName === 'TEXTAREA'
      ) {
        return
      }

      if (
        event.key === 'ArrowDown' ||
        event.key === 'PageDown'
      ) {
        event.preventDefault()
        go(1)
      }

      if (
        event.key === 'ArrowUp' ||
        event.key === 'PageUp'
      ) {
        event.preventDefault()
        go(-1)
      }

      if (event.key === 'm' || event.key === 'M') {
        toggleMute()
      }

      if (event.key === 'f' || event.key === 'F') {
        fullscreen()
      }

      if (event.key === ' ') {
        event.preventDefault()

        const active = videoRefs.current[index]

        if (!active) return

        if (active.paused) {
          active.play().catch(() => {})
        } else {
          active.pause()
        }
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
  }, [go, index])

  /*
   * Mouse wheel
   */
  useEffect(() => {
    const handleWheel = (event) => {
      if (wheelLock.current) return

      if (Math.abs(event.deltaY) < 20) return

      wheelLock.current = true

      go(event.deltaY > 0 ? 1 : -1)

      window.setTimeout(() => {
        wheelLock.current = false
      }, 450)
    }

    window.addEventListener(
      'wheel',
      handleWheel,
      { passive: true }
    )

    return () => {
      window.removeEventListener(
        'wheel',
        handleWheel
      )
    }
  }, [go])

  /*
   * Touch swipe
   */
  const handleTouchStart = (event) => {
    if (!event.touches?.length) return

    touchStart.current = {
      x: event.touches[0].clientX,
      y: event.touches[0].clientY
    }
  }

  const handleTouchEnd = (event) => {
    if (!touchStart.current) return
    if (!event.changedTouches?.length) return

    const end = event.changedTouches[0]

    const deltaX =
      end.clientX - touchStart.current.x

    const deltaY =
      end.clientY - touchStart.current.y

    touchStart.current = null

    /*
     * Ignore horizontal swipes.
     */
    if (Math.abs(deltaY) < 50) return

    if (Math.abs(deltaY) < Math.abs(deltaX)) {
      return
    }

    go(deltaY < 0 ? 1 : -1)
  }

  /*
   * Video error
   */
  const handleVideoError = () => {
    window.clearTimeout(videoLoadingTimer.current)

    setVideoLoading(false)
    setError('Unable to play this video.')
  }

  /*
   * Retry current video
   */
  const retryVideo = () => {
    setError('')

    const active = videoRefs.current[index]

    if (!active) return

    try {
      active.load()

      active.play().catch(() => {})
    } catch {}
  }

  /*
   * Loading screen
   */
  if (dataLoading) {
    return (
      <main className="reels-page">
        <div className="reels-loading">
          Loading...
        </div>
      </main>
    )
  }

  /*
   * Data error
   */
  if (error && !current) {
    return (
      <main className="reels-page">
        <div className="reels-error">
          <h1>Unable to load videos</h1>

          <p>{error}</p>

          <button
            type="button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </main>
    )
  }

  /*
   * No current video
   */
  if (!current) {
    return (
      <main className="reels-page">
        <div className="reels-error">
          <h1>No video available</h1>
        </div>
      </main>
    )
  }

  /*
   * Render previous/current/next
   */
  const wrappers = [-1, 0, 1]

  return (
    <main
      className={`reels-page fit-${fit}`}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="reels-container">
        {wrappers.map((offset) => {
          let position = index + offset

          if (position < 0) {
            position = order.length - 1
          }

          if (position >= order.length) {
            position = 0
          }

          const videoIndex = order[position]
          const video = videos[videoIndex]

          if (!video) return null

          const isCurrent = offset === 0

          return (
            <div
              key={`${video.video}-${position}`}
              className="video-wrapper"
              style={{
                transform:
                  `translateY(${offset * 100}%)`
              }}
            >
              <video
                ref={(element) => {
                  if (element) {
                    videoRefs.current[position] =
                      element
                  } else {
                    delete videoRefs.current[position]
                  }
                }}
                className={`reel-video ${
                  fit === 'fill'
                    ? 'video-fill'
                    : fit === 'auto'
                      ? 'video-auto'
                      : 'video-fit'
                }`}
                src={video.video}
                muted={muted}
                playsInline
                preload={
                  isCurrent
                    ? 'auto'
                    : 'metadata'
                }
                onTimeUpdate={
                  isCurrent
                    ? handleTimeUpdate
                    : undefined
                }
                onEnded={
                  isCurrent
                    ? () => go(1)
                    : undefined
                }
                onError={
                  isCurrent
                    ? handleVideoError
                    : undefined
                }
              />

              {isCurrent && videoLoading && (
                <div className="video-loading">
                  <div className="loading-spinner" />
                </div>
              )}

              {isCurrent && error && (
                <div className="video-error">
                  <p>{error}</p>

                  <button
                    type="button"
                    onClick={retryVideo}
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )
        })}

        /*
         * Top/bottom navigation touch zones
         */
        <button
          type="button"
          className="reel-prev-zone"
          aria-label="Previous video"
          onClick={() => {
            if (longPressActive.current) {
              longPressActive.current = false
              return
            }

            go(-1)
          }}
          onPointerDown={startHoldSpeed}
          onPointerUp={stopHoldSpeed}
          onPointerCancel={stopHoldSpeed}
          onPointerLeave={stopHoldSpeed}
        />

        <button
          type="button"
          className="reel-next-zone"
          aria-label="Next video"
          onClick={() => {
            if (longPressActive.current) {
              longPressActive.current = false
              return
            }

            go(1)
          }}
          onPointerDown={startHoldSpeed}
          onPointerUp={stopHoldSpeed}
          onPointerCancel={stopHoldSpeed}
          onPointerLeave={stopHoldSpeed}
        />

        {holdSpeedActive && (
          <div className="hold-speed-indicator">
            2×
          </div>
        )}

        /*
         * Progress bar
         */
        <div
          className="video-progress-container"
          onClick={seek}
        >
          <div
            className="video-progress"
            style={{
              width: `${progress}%`
            }}
          />
        </div>

        /*
         * Right controls
         */
        <div className="reels-controls">
          <ControlButton
            src={
              muted
                ? '/assets/mute.png'
                : '/assets/unmute.png'
            }
            alt={muted ? 'Unmute' : 'Mute'}
            onClick={toggleMute}
          />

          <ControlButton
            src="/assets/share.png"
            alt="Share"
            onClick={share}
          />

          <ControlButton
            src="/assets/fullscreen-logo.png"
            alt="Fullscreen"
            onClick={fullscreen}
          />

          <ControlButton
            src="/assets/download.png"
            alt="Download"
            onClick={download}
          />

          <ControlButton
            alt={`Speed ${speed}x`}
            onClick={changeSpeed}
          >
            {speed}x
          </ControlButton>

          <ControlButton
            alt={`Fit ${fit}`}
            onClick={changeFit}
          >
            {fit}
          </ControlButton>
        </div>

        /*
         * Video information
         */
        <div className="reel-info">
          {videoTitle && (
            <h1>{current.title}</h1>
          )}

          {current.post && (
            <button
              type="button"
              className="reel-post-button"
              onClick={() => {
                window.open(
                  current.post,
                  '_blank',
                  'noopener,noreferrer'
                )
              }}
            >
              View Post
            </button>
          )}
        </div>

        /*
         * Flash
         */
        {flash && (
          <div className="reels-flash">
            {flash}
          </div>
        )}

        /*
         * Optional app branding
         */
        {APP?.name && (
          <div className="reels-app-name">
            {APP.name}
          </div>
        )}
      </div>
    </main>
  )
}
