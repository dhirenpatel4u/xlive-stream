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

  // IMPORTANT:
  // Data loading and video loading are separate.
  const [dataLoading, setDataLoading] = useState(true)
  const [videoLoading, setVideoLoading] = useState(false)

  const [error, setError] = useState('')
  const [progress, setProgress] = useState(0)
  const [flash, setFlash] = useState('')

  const videoRefs = useRef([])
  const touchStart = useRef(null)
  const wheelLock = useRef(false)
  const holdTimer = useRef(null)
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
  // OPEN SPECIFIC REEL FROM URL
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
  // PLAY CURRENT VIDEO
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
      active.playbackRate = speed

      setVideoLoading(true)

      active
        .play()
        .catch(() => {
          // Browser may block autoplay.
          // User can press play manually.
        })
    }
  }, [index, muted, speed, videos, order])

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
  // MOUSE WHEEL
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
  // FLASH MESSAGE
  // --------------------------------------------------

  const showFlash = (text) => {
    setFlash(text)

    setTimeout(() => {
      setFlash('')
    }, 450)
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
  // VIDEO OPTIONS
  // --------------------------------------------------

  const toggleFit = () => {
    setFit(
      (f) => FITS[(FITS.indexOf(f) + 1) % FITS.length]
    )
  }

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
  // VIDEO CLICK / DOUBLE CLICK
  // --------------------------------------------------

  const clickVideo = (e) => {
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
  // LONG PRESS
  // --------------------------------------------------

  const holdStart = () => {
    holdTimer.current = setTimeout(() => {
      const v = videoRefs.current[index]

      if (v) {
        v.playbackRate = 2
        showFlash('2×')
      }
    }, 450)
  }

  const holdEnd = () => {
    clearTimeout(holdTimer.current)

    const v = videoRefs.current[index]

    if (v) {
      v.playbackRate = speed
    }
  }

  // --------------------------------------------------
  // INITIAL DATA LOADING ONLY
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

        <button onClick={() => window.location.reload()}>
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

  // --------------------------------------------------
  // THREE REEL POSITIONS
  // --------------------------------------------------

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

      <div className="live-button">
        <button onClick={() => navigate('/live')}>
          <img src="/assets/live.png" alt="" />
          <span>LIVE</span>
        </button>
      </div>

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

                /*
                 * IMPORTANT:
                 * Do NOT call setDataLoading(true) here.
                 * That was causing the infinite spinner.
                 */

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

                onWaiting={() => {
                  if (i === index) {
                    setVideoLoading(true)
                  }
                }}

                onPlaying={() => {
                  if (i === index) {
                    setVideoLoading(false)
                  }
                }}

                onError={() => {
                  if (i === index) {
                    setVideoLoading(false)
                    setError('Video could not be loaded.')
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

                onPointerDown={holdStart}
                onPointerUp={holdEnd}
                onPointerCancel={holdEnd}
                onPointerLeave={holdEnd}
              />

              <div className="video-info">
                <div className="video-title">
                  {data.isLive ? '🔴 Live - ' : ''}
                  {data.title}
                </div>
              </div>

            </article>
          ) : null
        )}

      </div>

      {/* VIDEO LOADING SPINNER */}
      {videoLoading && (
        <div className="spinner">
          <div className="loader" />
        </div>
      )}

      {error && (
        <div className="error-msg">
          <div>{error}</div>

          <button
            onClick={() => {
              setError('')
              setVideoLoading(true)

              const v = videoRefs.current[index]

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

      <div className="top-controls">

        <ControlButton
          icon={
            muted
              ? '/assets/mute.png'
              : '/assets/unmute.png'
          }
          onClick={() => setMuted((m) => !m)}
          title={muted ? 'Unmute' : 'Mute'}
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
          title="Change playback speed"
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

      {flash && (
        <div className="seek-flash">
          {flash}
        </div>
      )}

      <div className="reel-counter">
        {index + 1} / {order.length}
      </div>

    </main>
  )
}
