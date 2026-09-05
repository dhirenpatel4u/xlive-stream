```jsx
import { useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { APP } from '../config'

export default function Login({ onLogin }) {
  const navigate = useNavigate()
  const location = useLocation()

  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState('')

  const refs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null)
  ]

  const submit = (value = digits.join('')) => {
    if (value === APP.pin) {
      localStorage.setItem('xlive_logged_in', 'true')

      // Update App state immediately
      if (onLogin) {
        onLogin()
      }

      const target =
        new URLSearchParams(location.search).get('redirect') || '/'

      navigate(
        target.startsWith('/') ? target : '/',
        { replace: true }
      )
    } else {
      setError('Invalid PIN. Please try again.')
    }
  }

  const change = (i, value) => {
    const v = value.replace(/\D/g, '').slice(-1)

    const next = [...digits]
    next[i] = v

    setDigits(next)
    setError('')

    if (v && i < 3) {
      refs[i + 1].current?.focus()
    }

    if (v && i === 3 && next.every(Boolean)) {
      submit(next.join(''))
    }
  }

  const key = (i, e) => {
    if (
      e.key === 'Backspace' &&
      !digits[i] &&
      i > 0
    ) {
      refs[i - 1].current?.focus()
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">

        <img
          className="login-logo"
          src="/assets/your-logo.png"
          alt="Logo"
        />

        <h1>Enter Your PIN</h1>

        {error && (
          <p className="login-error">
            {error}
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault()
            submit()
          }}
        >
          <div className="pin-inputs">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={refs[i]}
                type="tel"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) =>
                  change(i, e.target.value)
                }
                onKeyDown={(e) => key(i, e)}
                aria-label={`PIN digit ${i + 1}`}
                required
              />
            ))}
          </div>

          <button
            className="login-submit"
            type="submit"
          >
            Submit
          </button>
        </form>

      </section>
    </main>
  )
}
```
