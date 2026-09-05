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
          let message = `HTTP ${r.status}`

          try {
            const errorData = await r.json()
            if (errorData?.error) {
              message = errorData.error
            }
          } catch {}

          throw new Error(message)
        }

        return r.json()
      })
      .then((data) => {
        console.log('Live API response:', data)

        let list = []

        if (Array.isArray(data)) {
          list = data
        } else if (Array.isArray(data.models)) {
          list = data.models
        } else if (Array.isArray(data.data)) {
          list = data.data
        } else if (Array.isArray(data.data?.models)) {
          list = data.data.models
        }

        const publicModels = list.filter(
          (x) => (x.status || 'public').toLowerCase() === 'public'
        )

        setModels(publicModels)
        setStatus('')
      })
      .catch((e) => {
        console.error('Live API error:', e)
        setStatus(`Unable to load live data: ${e.message}`)
      })
  }, [])

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
        {models.map((m, i) => (
          <article
            className="live-card"
            key={m.id || m.username || i}
          >
            <img
              src={m.image || m.avatar || m.thumbnail}
              alt={m.name || m.username || 'Live model'}
            />

            <h2>
              {m.name || m.username || 'Live model'}
            </h2>

            <span>🔴 LIVE</span>
          </article>
        ))}
      </section>
    </main>
  )
}
