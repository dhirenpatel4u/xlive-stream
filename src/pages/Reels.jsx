import {
useCallback,
useEffect,
useRef,
useState
} from 'react'
import { useLocation } from 'react-router-dom'
import ControlButton from '../components/ControlButton'
import { APP } from '../config'

const FITS = ['fit', 'fill', 'auto']
const SPEEDS = [1, 1.25, 1.5, 2]

function shuffle(array) {
const result = [...array]

for (let i = result.length - 1; i > 0; i--) {
const j = Math.floor(Math.random() * (i + 1))

;[result[i], result[j]] = [
  result[j],
  result[i]
]

}

return result
}

function getSlug(post, title) {
if (post) {
try {
const url = new URL(post)
const parts = url.pathname
.split('/')
.filter(Boolean)

  const slug = parts[parts.length - 1]

  if (slug) {
    return slug
  }
} catch {}

}

if (title) {
return title
.toLowerCase()
.trim()
.replace(/[^a-z0-9]+/g, '-')
.replace(/^-+|-+$/g, '')
}

return ''
}

export default function Reels() {
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

const videoRefs = useRef({})
const preloadRefs = useRef({})

const touchStart = useRef(null)
const wheelLock = useRef(false)

const holdTimer = useRef(null)
const videoLoadingTimer = useRef(null)
const flashTimer = useRef(null)

const wasPlayingBeforeHold = useRef(false)
const longPressActive = useRef(false)
const changingSpeed = useRef(false)

const videoRequestId = useRef(0)

const showFlash = useCallback((message) => {
setFlash(message)

window.clearTimeout(flashTimer.current)

flashTimer.current = window.setTimeout(() => {
  setFlash('')
}, 1600)

}, [])

/* ---------------- LOAD DATA ---------------- */

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

    let shuffled = shuffle(list)

    const params = new URLSearchParams(
      location.search
    )

    const reelTitle = params.get('reel')

    if (reelTitle) {
      let decodedTitle = reelTitle

      try {
        decodedTitle = decodeURIComponent(reelTitle)
      } catch {}

      const targetIndex = shuffled.findIndex(
        (video) =>
          (video.title || '')
            .trim()
            .toLowerCase() ===
          decodedTitle
            .trim()
            .toLowerCase()
      )

      if (targetIndex !== -1) {
        const target = shuffled[targetIndex]

        shuffled = [
          target,
          ...shuffled.filter(
            (_, i) => i !== targetIndex
          )
        ]
      }
    }

    setOrder(
      shuffled.map((video) => list.indexOf(video))
    )

    setIndex(0)
    setDataLoading(false)
  })
  .catch((err) => {
    if (cancelled) return

    setError(
      err.message || 'Unable to load videos.'
    )

    setDataLoading(false)
  })

return () => {
  cancelled = true
}

}, [location.search])

const currentVideoIndex = order[index]
const current = videos[currentVideoIndex]

/* ---------------- NAVIGATION ---------------- */

const go = useCallback(
(delta) => {
if (!order.length) return

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
[order.length]

)

/* ---------------- PAUSE OTHER VIDEOS ---------------- */

useEffect(() => {
Object.entries(videoRefs.current).forEach(
([position, video]) => {
if (!video) return

    if (Number(position) !== index) {
      video.pause()
    }
  }
)

}, [index])

/* ---------------- PLAY CURRENT VIDEO ---------------- */

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

videoLoadingTimer.current = window.setTimeout(() => {
  if (requestId !== videoRequestId.current) {
    return
  }

  if (
    active.paused ||
    active.readyState < 3
  ) {
    setVideoLoading(true)
  }
}, 1000)

const startVideo = async () => {
  try {
    active.load()

    await active.play()

    if (requestId !== videoRequestId.current) {
      return
    }

    window.clearTimeout(
      videoLoadingTimer.current
    )

    setVideoLoading(false)
  } catch {
    /*
      Browser may block autoplay.
      User can still interact with video.
    */
  }
}

startVideo()

return () => {
  window.clearTimeout(
    videoLoadingTimer.current
  )
}

}, [
current?.video,
index,
muted,
speed
])

/* ---------------- PRELOAD NEXT VIDEOS ---------------- */

useEffect(() => {
if (!order.length || !videos.length) {
return
}

const nextVideos = []

for (let i = 1; i <= 2; i++) {
  const position =
    (index + i) % order.length

  const videoIndex = order[position]
  const video = videos[videoIndex]

  if (video?.video) {
    nextVideos.push({
      position,
      video
    })
  }
}

Object.keys(preloadRefs.current).forEach(
  (key) => {
    const needed = nextVideos.some(
      (item) =>
        String(item.position) === key
    )

    if (!needed) {
      const element =
        preloadRefs.current[key]

      try {
        element.pause()
        element.removeAttribute('src')
        element.load()
      } catch {}

      delete preloadRefs.current[key]
    }
  }
)

nextVideos.forEach(({ position, video }) => {
  if (preloadRefs.current[position]) {
    return
  }

  const element =
    document.createElement('video')

  element.preload = 'auto'
  element.muted = true
  element.playsInline = true
  element.src = video.video

  preloadRefs.current[position] = element

  try {
    element.load()
  } catch {}
})

}, [
index,
order,
videos
])

/* ---------------- CONTROLS ---------------- */

const toggleMute = () => {
setMuted((value) => {
const next = !value

  Object.values(videoRefs.current).forEach(
    (video) => {
      if (video) {
        video.muted = next
      }
    }
  )

  return next
})

}

const changeSpeed = () => {
setSpeed((currentSpeed) => {
const currentIndex =
SPEEDS.indexOf(currentSpeed)

  const nextIndex =
    currentIndex === -1
      ? 0
      : (currentIndex + 1) % SPEEDS.length

  const nextSpeed = SPEEDS[nextIndex]

  Object.values(videoRefs.current).forEach(
    (video) => {
      if (video) {
        video.playbackRate = nextSpeed
      }
    }
  )

  showFlash(`${nextSpeed}×`)

  return nextSpeed
})

}

const changeFit = () => {
setFit((currentFit) => {
const currentIndex =
FITS.indexOf(currentFit)

  const nextIndex =
    currentIndex === -1
      ? 0
      : (currentIndex + 1) % FITS.length

  const nextFit = FITS[nextIndex]

  showFlash(nextFit)

  return nextFit
})

}

/* ---------------- LONG PRESS 2X ---------------- */

const startHoldSpeed = () => {
if (changingSpeed.current) {
return
}

longPressActive.current = false

window.clearTimeout(holdTimer.current)

holdTimer.current = window.setTimeout(() => {
  const active =
    videoRefs.current[index]

  if (!active) return

  longPressActive.current = true
  changingSpeed.current = true

  wasPlayingBeforeHold.current =
    !active.paused

  active.playbackRate = 2

  setHoldSpeedActive(true)
}, 450)

}

const stopHoldSpeed = () => {
window.clearTimeout(holdTimer.current)

if (!holdSpeedActive) {
  changingSpeed.current = false
  return
}

const active =
  videoRefs.current[index]

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

/* ---------------- PROGRESS ---------------- */

const handleTimeUpdate = (event) => {
const video = event.currentTarget

if (
  !video.duration ||
  !Number.isFinite(video.duration)
) {
  setProgress(0)
  return
}

setProgress(
  (video.currentTime / video.duration) * 100
)

}

const seek = (event) => {
event.stopPropagation()

const active =
  videoRefs.current[index]

if (
  !active ||
  !active.duration ||
  !Number.isFinite(active.duration)
) {
  return
}

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

/* ---------------- SHARE ---------------- */

const share = async () => {
if (!current) return

const slug = getSlug(
  current.post,
  current.title
)

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
      title:
        current.title ||
        'Watch Video',
      text:
        current.title ||
        'Watch Video',
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
} catch {}

}

/* ---------------- DOWNLOAD ---------------- */

const download = () => {
if (!current) return

const downloadUrl =
  current.download ||
  current.video

if (!downloadUrl) {
  showFlash('Download unavailable')
  return
}

const link =
  document.createElement('a')

link.href = downloadUrl
link.download =
  current.title || 'video'

link.target = '_blank'
link.rel =
  'noopener noreferrer'

document.body.appendChild(link)

link.click()

link.remove()

}

/* ---------------- FULLSCREEN ---------------- */

const fullscreen = async () => {
const active =
videoRefs.current[index]

if (!active) return

try {
  if (document.fullscreenElement) {
    await document.exitFullscreen()
    return
  }

  if (active.requestFullscreen) {
    await active.requestFullscreen()
  } else if (
    active.webkitEnterFullscreen
  ) {
    active.webkitEnterFullscreen()
  }
} catch {}

}

/* ---------------- KEYBOARD ---------------- */

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

  if (
    event.key === 'm' ||
    event.key === 'M'
  ) {
    toggleMute()
  }

  if (
    event.key === 'f' ||
    event.key === 'F'
  ) {
    fullscreen()
  }

  if (event.key === ' ') {
    event.preventDefault()

    const active =
      videoRefs.current[index]

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

/* ---------------- MOUSE WHEEL ---------------- */

useEffect(() => {
const handleWheel = (event) => {
if (wheelLock.current) {
return
}

  if (Math.abs(event.deltaY) < 20) {
    return
  }

  wheelLock.current = true

  go(
    event.deltaY > 0
      ? 1
      : -1
  )

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

/* ---------------- TOUCH ---------------- */

const handleTouchStart = (event) => {
if (!event.touches?.length) {
return
}

touchStart.current = {
  x: event.touches[0].clientX,
  y: event.touches[0].clientY
}

}

const handleTouchEnd = (event) => {
if (!touchStart.current) {
return
}

if (!event.changedTouches?.length) {
  return
}

const end =
  event.changedTouches[0]

const deltaX =
  end.clientX -
  touchStart.current.x

const deltaY =
  end.clientY -
  touchStart.current.y

touchStart.current = null

if (Math.abs(deltaY) < 50) {
  return
}

if (
  Math.abs(deltaY) <
  Math.abs(deltaX)
) {
  return
}

go(
  deltaY < 0
    ? 1
    : -1
)

}

/* ---------------- VIDEO ERROR ---------------- */

const handleVideoError = () => {
window.clearTimeout(
videoLoadingTimer.current
)

setVideoLoading(false)

setError(
  'Unable to play this video.'
)

}

const retryVideo = () => {
setError('')

const active =
  videoRefs.current[index]

if (!active) return

try {
  active.load()

  active.play().catch(() => {})
} catch {}

}

/* ---------------- LOADING ---------------- */

if (dataLoading) {
return (
<main className="reels-app">
<div className="loading-screen">
<div className="big-loader" />
</div>
</main>
)
}

if (error && !current) {
return (
<main className="reels-app">
<div className="error-screen">
<div>
<h1>
Unable to load videos
</h1>

        <p>{error}</p>

        <button
          type="button"
          onClick={() =>
            window.location.reload()
          }
        >
          Retry
        </button>
      </div>
    </div>
  </main>
)

}

if (!current) {
return (
<main className="reels-app">
<div className="error-screen">
<h1>
No video available
</h1>
</div>
</main>
)
}

/* ---------------- VISIBLE REELS ---------------- */

const positions = [-1, 0, 1]

return (
<main className="reels-app" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd} >
{/* VIDEO LAYER */}
<div className="video-container">
{positions.map((offset) => {
let position = index + offset

      if (position < 0) {
        position = order.length - 1
      }

      if (position >= order.length) {
        position = 0
      }

      const videoIndex =
        order[position]

      const video =
        videos[videoIndex]

      if (!video) {
        return null
      }

      const isCurrent =
        offset === 0

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
            className="reel-video"
            src={video.video}
            muted={muted}
            playsInline
            autoPlay={isCurrent}
            preload={
              isCurrent
                ? 'auto'
                : 'metadata'
            }
            style={{
              objectFit:
                fit === 'fill'
                  ? 'cover'
                  : fit === 'fit'
                    ? 'contain'
                    : 'cover'
            }}
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

          {isCurrent &&
            videoLoading && (
              <div className="spinner">
                <div className="loader" />
              </div>
            )}

          {isCurrent &&
            error && (
              <div className="error-msg">
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
  </div>

  {/* PREVIOUS / NEXT TOUCH AREAS */}
  <button
    type="button"
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
    style={{
      position: 'fixed',
      top: 0,
      bottom: 0,
      left: 0,
      width: '35%',
      border: 0,
      padding: 0,
      margin: 0,
      background: 'transparent',
      zIndex: 2000,
      cursor: 'pointer'
    }}
  />

  <button
    type="button"
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
    style={{
      position: 'fixed',
      top: 0,
      bottom: 0,
      right: 0,
      width: '35%',
      border: 0,
      padding: 0,
      margin: 0,
      background: 'transparent',
      zIndex: 2000,
      cursor: 'pointer'
    }}
  />

  {/* LOGO */}
  {APP?.logo ? (
    <div
      className="brand-logo"
      style={{
        zIndex: 10001
      }}
    >
      <img
        src={APP.logo}
        alt={
          APP?.name ||
          'XLive'
        }
      />
    </div>
  ) : (
    <div
      className="brand-logo"
      style={{
        zIndex: 10001,
        color: '#fff',
        fontSize: '20px',
        fontWeight: 'bold',
        textShadow: '0 0 5px #000'
      }}
    >
      {APP?.name || 'XLive'}
    </div>
  )}

  {/* RIGHT CONTROLS */}
  <div
    className="top-controls"
    style={{
      zIndex: 10000
    }}
  >
    <ControlButton
      src={
        muted
          ? '/assets/mute.png'
          : '/assets/unmute.png'
      }
      alt={
        muted
          ? 'Unmute'
          : 'Mute'
      }
      title={
        muted
          ? 'Unmute'
          : 'Mute'
      }
      onClick={(event) => {
        event.stopPropagation()
        toggleMute()
      }}
    />

    <ControlButton
      src="/assets/share.png"
      alt="Share"
      title="Share"
      onClick={(event) => {
        event.stopPropagation()
        share()
      }}
    />

    <ControlButton
      src="/assets/fullscreen-logo.png"
      alt="Fullscreen"
      title="Fullscreen"
      onClick={(event) => {
        event.stopPropagation()
        fullscreen()
      }}
    />

    <ControlButton
      src="/assets/download.png"
      alt="Download"
      title="Download"
      onClick={(event) => {
        event.stopPropagation()
        download()
      }}
    />

    <ControlButton
      label={`${speed}x`}
      title={`Speed ${speed}x`}
      onClick={(event) => {
        event.stopPropagation()
        changeSpeed()
      }}
    />

    <ControlButton
      label={fit}
      title={`Fit ${fit}`}
      onClick={(event) => {
        event.stopPropagation()
        changeFit()
      }}
    />
  </div>

  {/* VIDEO INFORMATION */}
  <div
    className="video-info"
    style={{
      zIndex: 10001
    }}
  >
    {current.title && (
      <div className="video-title">
        {current.title}
      </div>
    )}

    {current.post && (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()

          window.open(
            current.post,
            '_blank',
            'noopener,noreferrer'
          )
        }}
        style={{
          pointerEvents: 'auto',
          border: 0,
          background:
            'rgba(0,0,0,0.6)',
          color: '#fff',
          padding: '7px 10px',
          cursor: 'pointer'
        }}
      >
        View Post
      </button>
    )}
  </div>

  {/* PROGRESS BAR */}
  <div
    className="global-progress-container"
    onClick={seek}
    style={{
      zIndex: 10000
    }}
  >
    <div
      className="global-progress-bar"
      style={{
        width: `${progress}%`
      }}
    />
  </div>

  {/* LONG PRESS INDICATOR */}
  {holdSpeedActive && (
    <div
      className="seek-flash"
      style={{
        top: '50%',
        bottom: 'auto',
        transform:
          'translateY(-50%)',
        zIndex: 10002
      }}
    >
      2×
    </div>
  )}

  {/* FLASH MESSAGE */}
  {flash && (
    <div
      className="seek-flash"
      style={{
        zIndex: 10002
      }}
    >
      {flash}
    </div>
  )}
</main>

)
}
