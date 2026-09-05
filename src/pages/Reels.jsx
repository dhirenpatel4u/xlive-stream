
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

  // Shows 2x while finger is held.
  const [holdSpeedActive, setHoldSpeedActive] = useState(false)

  const videoRefs = useRef([])

  // Hidden preload video elements.
  // Only NEXT 2 videos are kept here.
  const preloadRefs = useRef({})

  const touchStart = useRef(null)
  const wheelLock = useRef(false)

  const holdTimer = useRef(null)

  const wasPlayingBeforeHold = useRef(false)
  const longPressActive = useRef(false)

  // Prevent speed changes from causing spinner.
  const changingSpeed = useRef(false)

  // Used to prevent stale video events from
  // changing the current loading/error state.
  const videoRequestId = useRef(0)

  // --------------------------------------------------
  // LOAD VIDEO DATA
  // --------------------------------------------------

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

        setError(e.message)
        setDataLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  // --------------------------------------------------
  // CURRENT VIDEO
  // --------------------------------------------------

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

  // --------------------------------------------------
  // CHANGE REEL
  // --------------------------------------------------

  const go = useCallback(
    (delta) => {
      if (!order.length) return

      clearTimeout(holdTimer.current)

      longPressActive.current = false
      setHoldSpeedActive(false)

      // Every navigation creates a new video request state.
      videoRequestId.current += 1

      setError('')
      setVideoLoading(true)
      setProgress(0)

      setIndex((i) => i + delta)
    },
    [order.length]
  )

  // --------------------------------------------------
  // URL REEL
  // --------------------------------------------------

  useEffect(() => {
    if (!videos.length) return

    const idxParam = new URLSearchParams(location.search).get('reel')

    if (!idxParam) return

    let decoded = idxParam

    try {
      decoded = decodeURIComponent(idxParam)
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

  // --------------------------------------------------
  // CURRENT VIDEO SETUP
  //
  // Only current visible video loads.
  // Other visible video elements use preload="none".
  //
  // NO POSTER.
  // --------------------------------------------------

  useEffect(() => {
    if (!videos.length || !order.length) return

    const active = videoRefs.current[index]

    if (!active) return

    // New request generation.
    videoRequestId.current += 1

    setError('')
    setProgress(0)
    setVideoLoading(true)

    // Stop every other rendered video.
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

      // Force the current video to load.
      active.load()

      active.play().catch(() => {
        // Some browsers reject autoplay temporarily.
        // onError/onCanPlay/onPlaying remain responsible
        // for the actual loading state.
      })
    } catch {
      setVideoLoading(false)
      setError('Video could not be loaded.')
    }
  }, [index, videos, order])

  // --------------------------------------------------
  // PRELOAD NEXT 2 VIDEOS
  //
  // Current:
  //   Full normal loading.
  //
  // Next 2:
  //   Background preload approximately 5 seconds.
  //
  // Previous / further videos:
  //   No preload.
  // --------------------------------------------------

  useEffect(() => {
    if (!videos.length || !order.length) return

    const nextIndexes = []

    // Get next 2 videos.
    for (let n = 1; n <= 2; n++) {
      const position =
        (index + n) % order.length

      const videoIndex = order[position]

      if (videoIndex !== undefined) {
        nextIndexes.push(videoIndex)
      }
    }

    // -----------------------------------------------
    // REMOVE OLD PRELOAD VIDEOS
    // -----------------------------------------------

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

    // -----------------------------------------------
    // CREATE NEXT-2 PRELOADERS
    // -----------------------------------------------

    nextIndexes.forEach((videoIndex) => {
      const data = videos[videoIndex]

      if (!data?.video) return

      // Already preloading.
      if (preloadRefs.current[videoIndex]) {
        return
      }

      const preloadVideo =
        document.createElement('video')

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

      // Start loading immediately.
      preloadVideo.load()

      // Check buffered amount frequently.
      const checkTimer = setInterval(() => {
        if (stopped) {
          clearInterval(checkTimer)
          return
        }

        stopAfterFiveSeconds()
      }, 250)

      // Safety timeout.
      const safetyTimeout = setTimeout(() => {
        clearInterval(checkTimer)
      }, 15000)

      preloadRefs.current[videoIndex] = {
        video: preloadVideo,
        timer: checkTimer,
        timeout: safetyTimeout
      }
    })

    // -----------------------------------------------
    // CLEANUP
    // -----------------------------------------------

    return () => {
      Object.keys(preloadRefs.current).forEach(
        (key) => {
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
        }
      )

      preloadRefs.current = {}
    }
  }, [index, videos, order])

  // --------------------------------------------------
  // MUTE
  // --------------------------------------------------

  useEffect(() => {
    const active = videoRefs.current[index]

    if (!active) return

    active.muted = muted
  }, [muted, index])

  // --------------------------------------------------
  // SPEED
  //
  // Changes playbackRate only.
  // Does not reload or pause.
  // --------------------------------------------------

  useEffect(() => {
    const active = videoRefs.current[index]

    if (!active) return

    if (longPressActive.current) return

    changingSpeed.current = true

    active.playbackRate = speed

    // Never show spinner just because speed changed.
    setVideoLoading(false)

    const timer = setTimeout(() => {
      changingSpeed.current = false
    }, 500)

    return () => {
      clearTimeout(timer)
    }
  }, [speed, index])

  // --------------------------------------------------
  // KEYBOARD
  // --------------------------------------------------

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
      window.removeEventListener(
        'keydown',
        key
      )
    }
  }, [go])

  // --------------------------------------------------
  // WHEEL
  // --------------------------------------------------

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

  // --------------------------------------------------
  // SEEK
  // --------------------------------------------------

  const seek = (e) => {
    const v = videoRefs.current[index]

    if (!v || !v.duration) return

    const r =
      e.currentTarget.getBoundingClientRect()

    v.currentTime =
      ((e.clientX - r.left) / r.width) *
      v.duration
  }

  // --------------------------------------------------
  // FLASH
  // --------------------------------------------------

  const showFlash = (text) => {
    setFlash(text)

    setTimeout(() => {
      setFlash('')
    }, 700)
  }

  // --------------------------------------------------
  // FULLSCREEN
  //
  // Only video becomes fullscreen.
  // --------------------------------------------------

  const toggleFullscreen = async () => {
    const video = videoRefs.current[index]

    if (!video) return

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
        return
      }

      // Chrome / Android / modern browsers.
      if (video.requestFullscreen) {
        await video.requestFullscreen()
        return
      }

      // Safari / iPhone.
      if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen()
      }
    } catch {}
  }

  // --------------------------------------------------
  // FIT
  // --------------------------------------------------

  const toggleFit = () => {
    setFit(
      (f) =>
        FITS[
          (FITS.indexOf(f) + 1) %
            FITS.length
        ]
    )
  }

  // --------------------------------------------------
  // SPEED
  // --------------------------------------------------

  const toggleSpeed = () => {
    setSpeed(
      (s) =>
        SPEEDS[
          (SPEEDS.indexOf(s) + 1) %
            SPEEDS.length
        ]
    )
  }

  // --------------------------------------------------
  // SHARE
  // --------------------------------------------------

  const share = async () => {
    if (!current) return

    const url =
      `${location.origin}/?reel=` +
      encodeURIComponent(
        current.title || ''
      )

    try {
      if (navigator.share) {
        await navigator.share({
          title:
            current.title ||
            APP.name,
          url
        })
      } else {
        await navigator.clipboard.writeText(
          url
        )

        showFlash('Link copied')
      }
    } catch {}
  }

  // --------------------------------------------------
  // DOWNLOAD
  // --------------------------------------------------

  const download = () => {
    if (!current?.download) return

    const a =
      document.createElement('a')

    a.href = current.download
    a.download = 'reel.mp4'
    a.target = '_blank'
    a.rel = 'noopener'

    a.click()
  }

  // --------------------------------------------------
  // TOUCH SWIPE
  // --------------------------------------------------

  const startTouch = (e) => {
    if (!e.touches?.length) return

    touchStart.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    }
  }

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

  // --------------------------------------------------
  // VIDEO CLICK
  //
  // Single tap does NOTHING.
  // Double tap does NOTHING.
  // --------------------------------------------------

  const clickVideo = (e) => {
    e.preventDefault()
    e.stopPropagation()

    // Intentionally empty.
  }

  // --------------------------------------------------
  // LONG PRESS START
  //
  // Hold for 450ms = temporary 2x.
  // --------------------------------------------------

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

    // Remember playback state.
    wasPlayingBeforeHold.current =
      !v.paused

    holdTimer.current =
      setTimeout(() => {
        const active =
          videoRefs.current[index]

        if (!active) return

        longPressActive.current =
          true

        // Keep 2x indicator visible
        // until finger is released.
        setHoldSpeedActive(true)

        // Temporary 2x.
        active.playbackRate = 2

        // Keep playing.
        if (
          wasPlayingBeforeHold.current
        ) {
          active.play().catch(() => {})
        }
      }, 450)
  }

  // --------------------------------------------------
  // LONG PRESS END
  //
  // Restore selected speed.
  // Never pause the video.
  // --------------------------------------------------

  const holdEnd = () => {
    clearTimeout(holdTimer.current)

    const v = videoRefs.current[index]

    if (!v) return

    if (longPressActive.current) {
      longPressActive.current = false

      // Hide 2x.
      setHoldSpeedActive(false)

      // Restore selected speed.
      v.playbackRate = speed

      // NEVER pause after release.
      if (
        wasPlayingBeforeHold.current
      ) {
        v.play().catch(() => {})
      }
    }
  }

  // --------------------------------------------------
  // CLEANUP HOLD
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      clearTimeout(
        holdTimer.current
      )

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

  // --------------------------------------------------
  // DATA LOADING
  // --------------------------------------------------

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

  const wrappers =
    [-1, 0, 1].map((offset) => ({
      offset,
      i: index + offset,
      data:
        videos[
          getIndex(index + offset)
        ]
    }))

  return (
    <main
      className="reels-app"
      onTouchStart={startTouch}
      onTouchEnd={endTouch}
    >

      {/* LIVE */}
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

      {/* LOGO */}
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

      {/* VIDEOS */}
      <div className="video-container">

        {wrappers.map(
          ({
            offset,
            i,
            data
          }) =>
            data ? (
              <article
                key={`${getIndex(
                  i
                )}-${i}`}
                className="video-wrapper"
                style={{
                  transform:
                    `translateY(${offset * 100}%)`
                }}
              >

                <video
                  ref={(el) => {
                    videoRefs.current[i] =
                      el
                  }}

                  /*
                   * NO POSTER.
                   *
                   * Only the current video is
                   * allowed to preload.
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

                  // Disable mobile long-press
                  // browser menu/download popup.
                  onContextMenu={(e) => {
                    e.preventDefault()
                  }}

                  onDragStart={(e) => {
                    e.preventDefault()
                  }}

                  // Single tap does nothing.
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

                  // --------------------------------
                  // VIDEO EVENTS
                  // --------------------------------

                  onLoadStart={() => {
                    if (i !== index) return

                    setVideoLoading(true)
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

                    setVideoLoading(false)
                    setError('')
                  }}

                  onPlaying={() => {
                    if (i !== index) return

                    setVideoLoading(false)
                    setError('')

                    changingSpeed.current =
                      false
                  }}

                  onWaiting={() => {
                    if (
                      i === index &&
                      !changingSpeed.current &&
                      !longPressActive.current
                    ) {
                      setVideoLoading(true)
                    }
                  }}

                  onStalled={() => {
                    if (i === index) {
                      setVideoLoading(true)
                    }
                  }}

                  onSuspend={() => {
                    /*
                     * Do not show an error on suspend.
                     * Browsers can legitimately suspend
                     * network loading temporarily.
                     */
                  }}

                  onError={() => {
                    if (i !== index) return

                    setVideoLoading(false)
                    setError(
                      'Video could not be loaded.'
                    )
                  }}

                  onTimeUpdate={(e) => {
                    if (i === index) {
                      setProgress(
                        e.currentTarget
                          .duration
                          ? (
                              e.currentTarget
                                .currentTime /
                              e.currentTarget
                                .duration
                            ) * 100
                          : 0
                      )
                    }
                  }}

                  onEnded={() => {
                    if (i === index) {
                      go(1)
                    }
                  }}

                  // --------------------------------
                  // LONG PRESS
                  // --------------------------------

                  onPointerDown={
                    holdStart
                  }

                  onPointerUp={
                    holdEnd
                  }

                  onPointerCancel={
                    holdEnd
                  }

                  onPointerLeave={
                    holdEnd
                  }
                />

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

      {/* VIDEO BUFFER SPINNER */}
      {videoLoading && !error && (
        <div className="spinner">
          <div className="loader" />
        </div>
      )}

      {/* ERROR */}
      {error && (
        <div className="error-msg">

          <div>{error}</div>

          <button
            onClick={() => {
              const v =
                videoRefs.current[
                  index
                ]

              setError('')
              setVideoLoading(true)
              setProgress(0)

              if (v) {
                try {
                  v.load()

                  v.play().catch(
                    () => {}
                  )
                } catch {
                  setVideoLoading(false)
                  setError(
                    'Video could not be loaded.'
                  )
                }
              } else {
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

      {/* CONTROLS */}
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
          onClick={
            toggleFullscreen
          }
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

      {/* PROGRESS */}
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

      {/* LONG PRESS 2X */}
      {holdSpeedActive && (
        <div className="seek-flash">
          2×
        </div>
      )}

      {/* NORMAL FLASH */}
      {flash &&
        !holdSpeedActive && (
          <div className="seek-flash">
            {flash}
          </div>
        )}

      {/* COUNTER */}
      <div className="reel-counter">
        {index + 1} / {order.length}
      </div>

    </main>
  )
}

