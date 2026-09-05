import { useEffect, useMemo, useRef, useState } from 'react'
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { APP } from './config'
import Login from './pages/Login'
import Reels from './pages/Reels'
import Live from './pages/Live'

function Protected({ children }) {
  const ok = localStorage.getItem('xlive_logged_in') === 'true'
  return ok ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Protected><Reels /></Protected>} />
      <Route path="/live" element={<Protected><Live /></Protected>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
