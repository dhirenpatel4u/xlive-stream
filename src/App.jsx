import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

import Login from './pages/Login'
import Reels from './pages/Reels'
import Live from './pages/Live'
import LiveWatch from './pages/LiveWatch'

function Protected({ children, loggedIn }) {
  if (!loggedIn) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  return children
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(
    () =>
      localStorage.getItem(
        'xlive_logged_in'
      ) === 'true'
  )

  return (
    <Routes>

      {/* ==============================
          LOGIN
      ============================== */}

      <Route
        path="/login"
        element={
          loggedIn ? (
            <Navigate
              to="/"
              replace
            />
          ) : (
            <Login
              onLogin={() =>
                setLoggedIn(true)
              }
            />
          )
        }
      />


      {/* ==============================
          PUBLIC REELS

          Shared URLs can open directly:
          /?reel=video-title
      ============================== */}

      <Route
        path="/"
        element={
          <Reels />
        }
      />


      {/* ==============================
          PROTECTED LIVE LIST
      ============================== */}

      <Route
        path="/live"
        element={
          <Protected
            loggedIn={loggedIn}
          >
            <Live />
          </Protected>
        }
      />


      {/* ==============================
          PROTECTED LIVE WATCH
      ============================== */}

      <Route
        path="/live-watch"
        element={
          <Protected
            loggedIn={loggedIn}
          >
            <LiveWatch />
          </Protected>
        }
      />


      {/* ==============================
          UNKNOWN ROUTES
      ============================== */}

      <Route
        path="*"
        element={
          <Navigate
            to="/"
            replace
          />
        }
      />

    </Routes>
  )
}
