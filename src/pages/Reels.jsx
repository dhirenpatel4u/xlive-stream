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

  const videoRefs = useRef([])

  const touchStart = useRef(null)
  const wheelLock = useRef(false)

  const holdTimer = useRef(null)

  // Tracks whether video was playing before long press.
  const wasPlayingBeforeHold = useRef(false)

  // Tracks whether long press actually activated.
  const longPressActive = useRef(false)

  const lastTap = useRef(0)

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
  // IMPORTANT:
  // This effect only runs when the REEL changes.
  // Changing speed does NOT reload the video.
  // --------------------------------------------------

  useEffect(() => {
    if (!videos.length || !order.length) return

    const active = videoRefs.current[index]

    videoRefs.current.forEach((v, i) => {
      if (v && i !== index) {
        try {
          v.pause()
          v.currentTime = 0
        } catch {}
      }
    })

    if (active) {
      active.muted = muted

      // Apply selected speed to the new video.
      active.playbackRate = speed

      setVideoLoading(true)

      active.play().catch(() => {})
    }
  }, [index, videos, order])

  // --------------------------------------------------
  // MUTE CHANGE
  //
  // Does NOT reload or restart video.
  // --------------------------------------------------

  useEffect(() => {
    const active = videoRefs.current[index]

    if (!active) return

    active.muted = muted
  }, [muted, index])

  // --------------------------------------------------
  // SPEED CHANGE
  //
  // ONLY changes playbackRate.
  // NEVER shows loading spinner.
  // NEVER restarts video.
  // --------------------------------------------------

  useEffect(() => {
    const active = videoRefs.current[index]

    if (!active) return

    // Don't overwrite temporary 2x long-press speed.
    if (longPressActive.current) return

    active.playbackRate = speed
  }, [speed, index])

  // --------------------------------------------------
  // KEYBOARD
  // --------------------------------------------------

  useEffect(() => {
    const key = (e) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault()

        go(1)
      }

      if (e.key === 'ArrowUp' || e.key === 'PageUp') {
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

    window.addEventListener('wheel', onWheel, {
      passive: false
    })

    return () => {
      window.removeEventListener('wheel', onWheel)
    }
  }, [go])

  // --------------------------------------------------
  // SEEK
  // --------------------------------------------------

  const seek = (e) => {
    const v = videoRefs.current[index]

    if (!v || !v.duration) return

    const r = e.currentTarget.getBoundingClientRect()

    v.currentTime =
      ((e.clientX - r.left) / r.width) * v.duration
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
  // --------------------------------------------------

  const toggleFullscreen = async () => {
    const el = document.documentElement

    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {}
  }

  // --------------------------------------------------
  // FIT
  // --------------------------------------------------

  const toggleFit = () => {
    setFit(
      (f) => FITS[(FITS.indexOf(f) + 1) % FITS.length]
    )
  }

  // --------------------------------------------------
  // SPEED
  // --------------------------------------------------

  const toggleSpeed = () => {
    setSpeed(
      (s) => SPEEDS[(SPEEDS.indexOf(s) + 1) % SPEEDS.length]
    )
  }

  // --------------------------------------------------
  // SHARE
  // --------------------------------------------------

  const share = async () => {
    if (!current) return

    const url =
      `${location.origin}/?reel=` +
      encodeURIComponent(current.title || '')

    try {
      if (navigator.share) {
        await navigator.share({
          title: current.title || APP.name,
          url
        })
      } else {
        await navigator.clipboard.writeText(url)

        showFlash('Link copied')
      }
    } catch {}
  }

  // --------------------------------------------------
  // DOWNLOAD
  // --------------------------------------------------

  const download = () => {
    if (!current?.download) return

    const a = document.createElement('a')

    a.href = current.download
    a.download = 'reel.mp4'
    a.target = '_blank'
    a.rel = 'noopener'

    a.click()
  }

  // --------------------------------------------------
  // TOUCH
  // --------------------------------------------------

  const startTouch = (e) => {
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
  // --------------------------------------------------

  const clickVideo = (e) => {
    // If this was a long press, don't execute
    // normal click/play-pause behavior.
    if (longPressActive.current) {
      longPressActive.current = false
      return
    }

    const now = Date.now()

    const v = videoRefs.current[index]

    if (now - lastTap.current < 280) {
      const r = e.currentTarget.getBoundingClientRect()

      const x = e.clientX - r.left

      if (v) {
        if (x < r.width / 2) {
          v.currentTime = Math.max(
            0,
            v.currentTime - 5
          )

          showFlash('−5s')
        } else {
          v.currentTime = Math.min(
            v.duration || v.currentTime + 5,
            v.currentTime + 5
          )

          showFlash('+5s')
        }
      }
    } else {
      if (v) {
        if (v.paused) {
          v.play().catch(() => {})
        } else {
          v.pause()
        }
      }
    }

    lastTap.current = now
  }

  // --------------------------------------------------
  // LONG PRESS START
  //
  // Hold = temporary 2x.
  // Does NOT change selected speed.
  // --------------------------------------------------

  const holdStart = () => {
    const v = videoRefs.current[index]

    if (!v) return

    // Remember current playback state.
    wasPlayingBeforeHold.current = !v.paused

    clearTimeout(holdTimer.current)

    holdTimer.current = setTimeout(() => {
      const active = videoRefs.current[index]

      if (!active) return

      longPressActive.current = true

      // Temporary 2x.
      active.playbackRate = 2

      // Keep playing if it was playing.
      if (wasPlayingBeforeHold.current) {
        active.play().catch(() => {})
      }

      // Show 2x only when long press actually starts.
      showFlash('2×')
    }, 450)
  }

  // --------------------------------------------------
  // LONG PRESS END
  //
  // Restore normal selected speed.
  // If video was playing before hold, keep playing.
  // If it was paused before hold, keep it paused.
  // --------------------------------------------------

  const holdEnd = () => {
    clearTimeout(holdTimer.current)

    const v = videoRefs.current[index]

    if (!v) return

    if (longPressActive.current) {
      longPressActive.current = false

      // Restore selected speed.
      v.playbackRate = speed

      // IMPORTANT:
      // Do NOT pause after releasing long press.
      if (wasPlayingBeforeHold.current) {
        v.play().catch(() => {})
      }
    }
  }

  // --------------------------------------------------
  // CLEAN UP HOLD TIMER
  // --------------------------------------------------

  useEffect(() => {
    return () => {
      clearTimeout(holdTimer.current)
    }
  }, [])

  // --------------------------------------------------
  // DATA LOADING ONLY
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
          onClick={() => window.location.reload()}
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

  const wrappers = [-1, 0, 1].map((offset) => ({
    offset,
    i: index + offset,
    data: videos[getIndex(index + offset)]
  }))

  return (
    <main
      className="reels-app"
      onTouchStart={startTouch}
      onTouchEnd={endTouch}
    >

      {/* LIVE */}
      <div className="live-button">
        <button onClick={() => navigate('/live')}>
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

        {wrappers.map(({ offset, i, data }) =>
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
                src={data.video}
                poster={data.image}
                playsInline
                preload={
                  Math.abs(offset) === 1
                    ? 'metadata'
                    : 'auto'
                }
                muted={muted}
                loop={false}
                style={{
                  objectFit:
                    fit === 'fill'
                      ? 'cover'
                      : fit === 'fit'
                        ? 'contain'
                        : 'cover'
                }}

                // -------------------------------
                // VIDEO EVENTS
                // -------------------------------

                onLoadStart={() => {
                  if (i === index) {
                    setVideoLoading(true)
                  }
                }}

                onCanPlay={() => {
                  if (i === index) {
                    setVideoLoading(false)
                  }
                }}

                onPlaying={() => {
                  if (i === index) {
                    setVideoLoading(false)
                  }
                }}

                onWaiting={() => {
                  // IMPORTANT:
                  // Waiting can happen during buffering,
                  // but changing playback speed itself
                  // must NOT manually trigger loading.
                  if (i === index) {
                    setVideoLoading(true)
                  }
                }}

                onError={() => {
                  if (i === index) {
                    setVideoLoading(false)
                    setError(
                      'Video could not be loaded.'
                    )
                  }
                }}

                onTimeUpdate={(e) => {
                  if (i === index) {
                    setProgress(
                      e.currentTarget.duration
                        ? (
                            e.currentTarget.currentTime /
                            e.currentTarget.duration
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

                onClick={clickVideo}

                // -------------------------------
                // LONG PRESS
                // -------------------------------

                onPointerDown={holdStart}

                onPointerUp={holdEnd}

                onPointerCancel={holdEnd}

                onPointerLeave={holdEnd}
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
      {videoLoading && (
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
              setError('')
              setVideoLoading(true)

              const v =
                videoRefs.current[index]

              if (v) {
                v.load()

                v.play().catch(() => {})
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

      {/* FLASH */}
      {flash && (
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
