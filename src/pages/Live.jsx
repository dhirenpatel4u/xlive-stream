import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP } from '../config'

export default function Live() {
  const navigate = useNavigate()

  const [models, setModels] = useState([])
  const [status, setStatus] = useState('Loading live data…')

  useEffect(() => {
    if (!APP.liveApiUrl) {
      setStatus('Live API is not configured.')
      return
    }

    fetch(APP.liveApiUrl)
      .then(async (r) => {
        if (!r.ok) {
          throw new Error(`HTTP ${r.status}`)
        }

        return r.json()
      })
      .then((data) => {
        console.log('Live API response:', data)

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.models)
            ? data.models
            : Array.isArray(data.data)
              ? data.data
              : []

        if (!list.length) {
          throw new Error('No live models found')
        }

        setModels(list)
        setStatus('')
      })
      .catch((e) => {
        console.error('Live API error:', e)
        setStatus(`Unable to load live data: ${e.message}`)
      })
  }, [])

  const openLive = (model) => {
    navigate('/live-watch', {
      state: {
        title: model.title,
        image: model.image,
        video: model.video,
      },
    })
  }

  return (
    <main className="live-page">
      <header className="live-header">
        <button
          onClick={() => navigate('/')}
          className="back-btn"
        >
          ←
        </button>

        <img
          src="/assets/your-logo.png"
          alt={APP.name}
        />

        <h1>Live</h1>
      </header>

      {status && (
        <div className="live-status">
          {status}
        </div>
      )}

      <section className="live-grid">
        {models.map((model, index) => (
          <article
            className="live-card"
            key={model.title || index}
            onClick={() => openLive(model)}
          >
            <div className="live-image-wrapper">
              <img
                src={model.image}
                alt={model.title || 'Live'}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.display = 'none'
                }}
              />

              <span className="live-badge">
                🔴 LIVE
              </span>
            </div>

            <h2>
              {model.title || 'Live model'}
            </h2>
          </article>
        ))}
      </section>
    </main>
  )
}
