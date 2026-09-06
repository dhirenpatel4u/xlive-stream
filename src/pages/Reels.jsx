import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import ControlButton from '../components/ControlButton'
import { APP } from '../config'

const FITS = ['fit', 'fill', 'auto']
const SPEEDS = [1, 1.25, 1.5, 2]

function shuffle(arr) {
  const a = [...arr]

  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))

    ;[a[i], a[j]] = [a[j], a[i]]
  }

  return a
}

export default function Reels() {
  const navigate = useNavigate()
  const location = useLocation()

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

  const videoRefs = useRef([])
  const preloadRefs = useRef({})

  const touchStart = useRef(null)
  const wheelLock = useRef(false)

  const holdTimer = useRef(null)
  const videoLoadingTimer = useRef(null)

  const wasPlayingBeforeHold = useRef(false)
  const longPressActive = useRef(false)

  const changingSpeed = useRef(false)
  const videoRequestId = useRef(0)

  // ==================================================
  // LOAD DATA
  // ==================================================

  useEffect(() => {
    let cancelled = false

    setDataLoading(true)
    setError('')

    fetch('/data/videos.json', {
      cache: 'no-store'
    })
      .then((r) => {
        if (!r.ok) {
          throw new Error('Unable to load videos.json')
        }

        return r.json()
      })
      .then((data) => {
        if (cancelled) return

        const list = Array.isArray(data) ? data : []

        setVideos(list)
        setOrder(shuffle(list.map((_, i) => i)))
        setIndex(0)
        setDataLoading(false)
      })
      .catch((e) => {
        if (cancelled) return

        setError(e.message || 'Unable to load videos.')
        setDataLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // ==================================================
  // CURRENT VIDEO
  // ==================================================

  const current = order.length
    ? videos[order[(index + order.length) % order.length]]
    : null

  const getIndex = useCallback(
    (i) => {
      if (!order.length) return -1

      return order[(i + order.length) % order.length]
    },
    [order]
  )

  // ==================================================
  // NEXT / PREVIOUS
  // ==================================================

  const go = useCallback(
    (delta) => {
      if (!order.length) return

      clearTimeout(holdTimer.current)
      clearTimeout(videoLoadingTimer.current)

      longPressActive.current = false
      setHoldSpeedActive(false)

      videoRequestId.current += 1

      setError('')
      setVideoLoading(false)
      setProgress(0)

      setIndex((i) => i + delta)
    },
    [order.length]
  )

  // ==================================================
  // OPEN REEL FROM ?reel=
  // ==================================================

  useEffect(() => {
    if (!videos.length) return

    const reelParam =
      new URLSearchParams(location.search).get('reel')

    if (!reelParam) return

    let decoded = reelParam

    try {
      decoded = decodeURIComponent(reelParam)
    } catch {}

    const found = videos.findIndex(
      (v) =>
        (v.title || '').trim().toLowerCase() ===
        decoded.trim().toLowerCase()
    )

    if (found >= 0) {
      setOrder((prev) => {
        const rest = prev.filter((x) => x !== found)

        return [found, ...rest]
      })

      setIndex(0)
    }
  }, [videos, location.search])

  // ==================================================
  // CURRENT VIDEO SETUP
  // ==================================================

  useEffect(() => {
    if (!videos.length || !order.length) return

    const active = videoRefs.current[index]

    if (!active) return

    clearTimeout(videoLoadingTimer.current)

    videoRequestId.current += 1

    const requestId = videoRequestId.current

    setError('')
    setProgress(0)

    // No spinner immediately.
    setVideoLoading(false)

    // Stop other videos.
    videoRefs.current.forEach((v, i) => {
      if (v && i !== index) {
        try {
          v.pause()
          v.currentTime = 0
        } catch {}
      }
    })

    try {
      active.muted = muted
      active.playbackRate = speed

      active.load()

      const playPromise = active.play()

      if (playPromise) {
        playPromise.catch(() => {})
      }

      // Show spinner only after 1 second.
      videoLoadingTimer.current = setTimeout(() => {
        if (requestId !== videoRequestId.current) {
          return
        }

        const currentVideo =
          videoRefs.current[index]

        if (!currentVideo) return

        if (
          !currentVideo.paused &&
          currentVideo.readyState >= 2
        ) {
          return
        }

        setVideoLoading(true)
      }, 1000)
    } catch {
      setVideoLoading(false)
      setError('Video could not be loaded.')
    }

    return () => {
      clearTimeout(videoLoadingTimer.current)
    }
  }, [index, videos, order])

  // ==================================================
  // PRELOAD NEXT 2 VIDEOS
  // ==================================================

  useEffect(() => {
    if (!videos.length || !order.length) return

    const nextIndexes = []

    for (let n = 1; n <= 2; n++) {
      const position = (index + n) % order.length
      const videoIndex = order[position]

      if (videoIndex !== undefined) {
        nextIndexes.push(videoIndex)
      }
    }

    // Remove old preloaders.
    Object.keys(preloadRefs.current).forEach((key) => {
      const videoIndex = Number(key)

      if (!nextIndexes.includes(videoIndex)) {
        const item = preloadRefs.current[videoIndex]

        if (item?.video) {
          try {
            item.video.pause()
            item.video.removeAttribute('src')
            item.video.load()
          } catch {}
        }

        if (item?.timer) {
          clearInterval(item.timer)
        }

        if (item?.timeout) {
          clearTimeout(item.timeout)
        }

        delete preloadRefs.current[videoIndex]
      }
    })

    // Create next 2 preloaders.
    nextIndexes.forEach((videoIndex) => {
      const data = videos[videoIndex]

      if (!data?.video) return

      if (preloadRefs.current[videoIndex]) {
        return
      }

      const preloadVideo = document.createElement('video')

      preloadVideo.preload = 'auto'
      preloadVideo.muted = true
      preloadVideo.playsInline = true

      preloadVideo.setAttribute(
        'playsinline',
        ''
      )

      preloadVideo.setAttribute(
        'webkit-playsinline',
        'true'
      )

      preloadVideo.src = data.video

      let stopped = false

      const stopAfterFiveSeconds = () => {
        if (stopped) return

        try {
          if (!preloadVideo.buffered.length) {
            return
          }

          const bufferedEnd =
            preloadVideo.buffered.end(
              preloadVideo.buffered.length - 1
            )

          if (bufferedEnd >= 5) {
            stopped = true

            preloadVideo.pause()

            preloadVideo.removeEventListener(
              'progress',
              stopAfterFiveSeconds
            )

            preloadVideo.removeEventListener(
              'canprogress',
              stopAfterFiveSeconds
            )
          }
        } catch {}
      }

      preloadVideo.addEventListener(
        'progress',
        stopAfterFiveSeconds
      )

      preloadVideo.addEventListener(
        'canprogress',
        stopAfterFiveSeconds
      )

      preloadVideo.load()

      const checkTimer = setInterval(() => {
        if (stopped) {
          clearInterval(checkTimer)
          return
        }

        stopAfterFiveSeconds()
      }, 250)

      const safetyTimeout = setTimeout(() => {
        clearInterval(checkTimer)
      }, 15000)

      preloadRefs.current[videoIndex] = {
        video: preloadVideo,
        timer: checkTimer,
        timeout: safetyTimeout
      }
    })

    return () => {
      Object.keys(preloadRefs.current).forEach((key) => {
        const item = preloadRefs.current[key]

        if (item?.video) {
          try {
            item.video.pause()
            item.video.removeAttribute('src')
            item.video.load()
          } catch {}
        }

        if (item?.timer) {
          clearInterval(item.timer)
        }

        if (item?.timeout) {
          clearTimeout(item.timeout)
        }
      })

      preloadRefs.current = {}
    }
  }, [index, videos, order])

  // ==================================================
  // MUTE
  // ==================================================

  useEffect(() => {
    const active = videoRefs.current[index]

    if (!active) return

    active.muted = muted
  }, [muted, index])

  // ==================================================
  // SPEED
  // ==================================================

  useEffect(() => {
    const active = videoRefs.current[index]

    if (!active) return

    if (longPressActive.current) return

    changingSpeed.current = true

    active.playbackRate = speed

    setVideoLoading(false)

    const timer = setTimeout(() => {
      changingSpeed.current = false
    }, 500)

    return () => {
      clearTimeout(timer)
    }
  }, [speed, index])

  // ==================================================
  // KEYBOARD
  // ==================================================

  useEffect(() => {
    const key = (e) => {
      if (
        e.key === 'ArrowDown' ||
        e.key === 'PageDown'
      ) {
        e.preventDefault()
        go(1)
      }

      if (
        e.key === 'ArrowUp' ||
        e.key === 'PageUp'
      ) {
        e.preventDefault()
        go(-1)
      }

      if (e.key === 'm') {
        setMuted((m) => !m)
      }

      if (e.key === 'f') {
        toggleFullscreen()
      }

      if (
        e.key === 'Escape' &&
        document.fullscreenElement
      ) {
        document.exitFullscreen()
      }
    }

    window.addEventListener('keydown', key)

    return () => {
      window.removeEventListener('keydown', key)
    }
  }, [go])

  // ==================================================
  // WHEEL
  // ==================================================

  useEffect(() => {
    const onWheel = (e) => {
      if (wheelLock.current) return

      if (Math.abs(e.deltaY) < 25) return

      wheelLock.current = true

      go(e.deltaY > 0 ? 1 : -1)

      setTimeout(() => {
        wheelLock.current = false
      }, 450)
    }

    window.addEventListener(
      'wheel',
      onWheel,
      {
        passive: false
      }
    )

    return () => {
      window.removeEventListener(
        'wheel',
        onWheel
      )
    }
  }, [go])

  // ==================================================
  // SEEK
  // ==================================================

  const seek = (e) => {
    const v = videoRefs.current[index]

    if (!v || !v.duration) return

    const r =
      e.currentTarget.getBoundingClientRect()

    v.currentTime =
      ((e.clientX - r.left) / r.width) *
      v.duration
  }

  // ==================================================
  // FLASH
  // ==================================================

  const showFlash = (text) => {
    setFlash(text)

    setTimeout(() => {
      setFlash('')
    }, 700)
  }

  // ==================================================
  // FULLSCREEN
  // ==================================================

  const toggleFullscreen = async () => {
    const video = videoRefs.current[index]

    if (!video) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      if (video.requestFullscreen) {
        await video.requestFullscreen()
        return
      }

      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen()
      }
    } catch {}
  }

  // ==================================================
  // FIT
  // ==================================================

  const toggleFit = () => {
    setFit(
      (f) =>
        FITS[
          (FITS.indexOf(f) + 1) % FITS.length
        ]
    )
  }

  // ==================================================
  // SPEED
  // ==================================================

  const toggleSpeed = () => {
    setSpeed(
      (s) =>
        SPEEDS[
          (SPEEDS.indexOf(s) + 1) %
            SPEEDS.length
        ]
    )
  }

  // ==================================================
  // SHARE
  // ==================================================

  const share = async () => {
    if (!current?.title) return

    // IMPORTANT:
    // Always use the actual /share route.
    //
    // This prevents:
    // /undefined/?reel=...
    //
    // Result:
    // https://xlive-stream.vercel.app/share?reel=Video
    const url =
      `${window.location.origin}/share?reel=` +
      encodeURIComponent(current.title)

    try {
      if (navigator.share) {
        await navigator.share({
          title: current.title,
          text: current.title,
          url
        })
      } else {
        await navigator.clipboard.writeText(url)

        showFlash('Link copied')
      }
    } catch {
      // User cancelled share.
    }
  }

  // ==================================================
  // DOWNLOAD
  // ==================================================

  const download = () => {
    if (!current?.download) return

    const a = document.createElement('a')

    a.href = current.download
    a.download = 'reel.mp4'
    a.target = '_blank'
    a.rel = 'noopener'

    a.click()
  }

  // ==================================================
  // TOUCH START
  // ==================================================

  const startTouch = (e) => {
    if (!e.touches?.length) return

    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
  }

  // ==================================================
  // TOUCH END
  // ==================================================

  const endTouch = (e) => {
    if (!touchStart.current) return

    const dy =
      e.changedTouches[0].clientY -
      touchStart.current.y

    const dx =
      e.changedTouches[0].clientX -
      touchStart.current.x

    touchStart.current = null

    if (
      Math.abs(dy) > 50 &&
      Math.abs(dy) > Math.abs(dx)
    ) {
      go(dy < 0 ? 1 : -1)
    }
  }

  // ==================================================
  // VIDEO CLICK
  // ==================================================

  const clickVideo = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }

  // ==================================================
  // LONG PRESS START
  // ==================================================

  const holdStart = (e) => {
    if (
      e.pointerType === 'mouse' &&
      e.button !== 0
    ) {
      return
    }

    const v = videoRefs.current[index]

    if (!v) return

    clearTimeout(holdTimer.current)

    wasPlayingBeforeHold.current =
      !v.paused

    holdTimer.current = setTimeout(() => {
      const active =
        videoRefs.current[index]

      if (!active) return

      longPressActive.current = true

      setHoldSpeedActive(true)

      active.playbackRate = 2

      if (
        wasPlayingBeforeHold.current
      ) {
        active.play().catch(() => {})
      }
    }, 450)
  }

  // ==================================================
  // LONG PRESS END
  // ==================================================

  const holdEnd = () => {
    clearTimeout(holdTimer.current)

    const v = videoRefs.current[index]

    if (!v) return

    if (longPressActive.current) {
      longPressActive.current = false

      setHoldSpeedActive(false)

      v.playbackRate = speed

      if (
        wasPlayingBeforeHold.current
      ) {
        v.play().catch(() => {})
      }
    }
  }

  // ==================================================
  // CLEANUP
  // ==================================================

  useEffect(() => {
    return () => {
      clearTimeout(holdTimer.current)
      clearTimeout(videoLoadingTimer.current)

      Object.keys(
        preloadRefs.current
      ).forEach((key) => {
        const item =
          preloadRefs.current[key]

        if (item?.video) {
          try {
            item.video.pause()
            item.video.removeAttribute('src')
            item.video.load()
          } catch {}
        }

        if (item?.timer) {
          clearInterval(item.timer)
        }

        if (item?.timeout) {
          clearTimeout(item.timeout)
        }
      })

      preloadRefs.current = {}
    }
  }, [])

  // ==================================================
  // DATA LOADING
  // ==================================================

  if (dataLoading) {
    return (
      <div className="loading-screen">
        <div className="big-loader" />
      </div>
    )
  }

  if (error && !videos.length) {
    return (
      <div className="error-screen">
        <p>{error}</p>

        <button
          onClick={() =>
            window.location.reload()
          }
        >
          Retry
        </button>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="error-screen">
        <p>No reels found.</p>
      </div>
    )
  }

  // ==================================================
  // THREE VISIBLE POSITIONS
  // ==================================================

  const wrappers =
    [-1, 0, 1].map((offset) => ({
      offset,
      i: index + offset,
      data:
        videos[
          getIndex(index + offset)
        ]
    }))

  // ==================================================
  // RENDER
  // ==================================================

  return (
    <main
      className="reels-app"
      onTouchStart={startTouch}
      onTouchEnd={endTouch}
    >

      {/* ============================================
          LIVE BUTTON
      ============================================ */}

      <div className="live-button">
        <button
          onClick={() =>
            navigate('/live')
          }
        >
          <img
            src="/assets/live.png"
            alt=""
          />

          <span>LIVE</span>
        </button>
      </div>

      {/* ============================================
          LOGO
      ============================================ */}

      <div
        className="brand-logo"
        onClick={() => {
          setIndex(0)
          navigate('/')
        }}
      >
        <img
          src="/assets/your-logo.png"
          alt={APP.name}
        />
      </div>

      {/* ============================================
          VIDEO CONTAINER
      ============================================ */}

      <div className="video-container">

        {wrappers.map(
          ({
            offset,
            i,
            data
          }) =>
            data ? (
              <article
                key={`${getIndex(i)}-${i}`}
                className="video-wrapper"
                style={{
                  transform:
                    `translateY(${offset * 100}%)`
                }}
              >

                <video
                  ref={(el) => {
                    videoRefs.current[i] = el
                  }}

                  /*
                   * NO POSTER.
                   *
                   * Video only.
                   */

                  src={data.video}

                  preload={
                    i === index
                      ? 'auto'
                      : 'none'
                  }

                  playsInline
                  webkit-playsinline="true"

                  muted={muted}

                  loop={false}

                  draggable={false}

                  controls={false}

                  onContextMenu={(e) => {
                    e.preventDefault()
                  }}

                  onDragStart={(e) => {
                    e.preventDefault()
                  }}

                  onClick={clickVideo}

                  style={{
                    objectFit:
                      fit === 'fill'
                        ? 'cover'
                        : fit === 'fit'
                          ? 'contain'
                          : 'cover',

                    WebkitTouchCallout:
                      'none',

                    WebkitUserSelect:
                      'none',

                    userSelect:
                      'none',

                    WebkitTapHighlightColor:
                      'transparent'
                  }}

                  // =================================
                  // VIDEO LOADING
                  // =================================

                  onLoadStart={() => {
                    if (i !== index) return

                    // No immediate spinner.
                    setError('')
                  }}

                  onLoadedMetadata={(e) => {
                    if (i !== index) return

                    const video =
                      e.currentTarget

                    video.muted = muted
                    video.playbackRate = speed
                  }}

                  onCanPlay={() => {
                    if (i !== index) return

                    clearTimeout(
                      videoLoadingTimer.current
                    )

                    setVideoLoading(false)
                    setError('')
                  }}

                  onPlaying={() => {
                    if (i !== index) return

                    clearTimeout(
                      videoLoadingTimer.current
                    )

                    setVideoLoading(false)
                    setError('')

                    changingSpeed.current =
                      false
                  }}

                  // =================================
                  // BUFFERING
                  // =================================

                  onWaiting={() => {
                    if (
                      i !== index ||
                      changingSpeed.current ||
                      longPressActive.current
                    ) {
                      return
                    }

                    clearTimeout(
                      videoLoadingTimer.current
                    )

                    videoLoadingTimer.current =
                      setTimeout(() => {
                        const v =
                          videoRefs.current[
                            index
                          ]

                        if (!v) return

                        if (
                          v.paused ||
                          v.readyState < 3
                        ) {
                          setVideoLoading(true)
                        }
                      }, 1000)
                  }}

                  onStalled={() => {
                    if (i !== index) return

                    if (
                      changingSpeed.current ||
                      longPressActive.current
                    ) {
                      return
                    }

                    clearTimeout(
                      videoLoadingTimer.current
                    )

                    videoLoadingTimer.current =
                      setTimeout(() => {
                        const v =
                          videoRefs.current[
                            index
                          ]

                        if (!v) return

                        if (
                          v.paused ||
                          v.readyState < 3
                        ) {
                          setVideoLoading(true)
                        }
                      }, 1000)
                  }}

                  // =================================
                  // ERROR
                  // =================================

                  onError={() => {
                    if (i !== index) return

                    clearTimeout(
                      videoLoadingTimer.current
                    )

                    setVideoLoading(false)

                    setError(
                      'Video could not be loaded.'
                    )
                  }}

                  // =================================
                  // PROGRESS
                  // =================================

                  onTimeUpdate={(e) => {
                    if (i !== index) return

                    const video =
                      e.currentTarget

                    if (
                      video.duration &&
                      Number.isFinite(
                        video.duration
                      )
                    ) {
                      setProgress(
                        (video.currentTime /
                          video.duration) *
                          100
                      )
                    }
                  }}

                  // =================================
                  // ENDED
                  // =================================

                  onEnded={() => {
                    if (i === index) {
                      go(1)
                    }
                  }}

                  // =================================
                  // LONG PRESS 2X
                  // =================================

                  onPointerDown={holdStart}
                  onPointerUp={holdEnd}
                  onPointerCancel={holdEnd}
                  onPointerLeave={holdEnd}
                />

                {/* ==================================
                    VIDEO INFO
                ================================== */}

                <div className="video-info">

                  <div className="video-title">
                    {data.isLive
                      ? '🔴 Live - '
                      : ''}

                    {data.title}
                  </div>

                </div>

              </article>
            ) : null
        )}

      </div>

      {/* ============================================
          VIDEO SPINNER
      ============================================ */}

      {videoLoading && !error && (
        <div className="spinner">
          <div className="loader" />
        </div>
      )}

      {/* ============================================
          ERROR
      ============================================ */}

      {error && (
        <div className="error-msg">

          <div>
            {error}
          </div>

          <button
            onClick={() => {
              const v =
                videoRefs.current[index]

              clearTimeout(
                videoLoadingTimer.current
              )

              setError('')
              setVideoLoading(false)
              setProgress(0)

              if (!v) {
                setError(
                  'Video could not be loaded.'
                )

                return
              }

              try {
                v.load()

                const playPromise =
                  v.play()

                if (playPromise) {
                  playPromise.catch(
                    () => {}
                  )
                }

                videoLoadingTimer.current =
                  setTimeout(() => {
                    if (
                      v.paused ||
                      v.readyState < 2
                    ) {
                      setVideoLoading(true)
                    }
                  }, 1000)
              } catch {
                setVideoLoading(false)

                setError(
                  'Video could not be loaded.'
                )
              }
            }}
          >
            Retry
          </button>

        </div>
      )}

      {/* ============================================
          CONTROLS
      ============================================ */}

      <div className="top-controls">

        <ControlButton
          icon={
            muted
              ? '/assets/mute.png'
              : '/assets/unmute.png'
          }
          onClick={() =>
            setMuted((m) => !m)
          }
          title={
            muted
              ? 'Unmute'
              : 'Mute'
          }
        />

        <ControlButton
          label={
            fit === 'fit'
              ? 'Fit'
              : fit === 'fill'
                ? 'Fill'
                : 'Auto'
          }
          onClick={toggleFit}
          title="Change video fit"
        />

        <ControlButton
          label={`${speed}x`}
          onClick={toggleSpeed}
          title="Change video speed"
        />

        <ControlButton
          icon="/assets/fullscreen-logo.png"
          onClick={toggleFullscreen}
          title="Fullscreen"
        />

        {current.download && (
          <ControlButton
            icon="/assets/download.png"
            onClick={download}
            title="Download"
          />
        )}

        <ControlButton
          icon="/assets/share.png"
          onClick={share}
          title="Share"
        />

        <ControlButton
          icon="/assets/logout.png"
          onClick={() => {
            localStorage.removeItem(
              'xlive_logged_in'
            )

            navigate('/login', {
              replace: true
            })
          }}
          title="Logout"
        />

      </div>

      {/* ============================================
          PROGRESS
      ============================================ */}

      <div
        className="global-progress-container"
        onClick={seek}
      >
        <div
          className="global-progress-bar"
          style={{
            width: `${progress}%`
          }}
        />
      </div>

      {/* ============================================
          2X INDICATOR
      ============================================ */}

      {holdSpeedActive && (
        <div className="seek-flash">
          2×
        </div>
      )}

      {flash &&
        !holdSpeedActive && (
          <div className="seek-flash">
            {flash}
          </div>
        )}

      {/* ============================================
          COUNTER
      ============================================ */}

      <div className="reel-counter">
        {index + 1} / {order.length}
      </div>

    </main>
  )
}

