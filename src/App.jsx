import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Login from './pages/Login'
import Reels from './pages/Reels'
import Live from './pages/Live'

function Protected({ children, loggedIn }) {
  return loggedIn ? children : <Navigate to="/login" replace />
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(
    () => localStorage.getItem('xlive_logged_in') === 'true'
  )

  return (
    <Routes>
      <Route
        path="/login"
        element={
          loggedIn
            ? <Navigate to="/" replace />
            : <Login onLogin={() => setLoggedIn(true)} />
        }
      />

      <Route
        path="/"
        element={
          <Protected loggedIn={loggedIn}>
            <Reels />
          </Protected>
        }
      />

      <Route
        path="/live"
        element={
          <Protected loggedIn={loggedIn}>
            <Live />
          </Protected>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
