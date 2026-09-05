import { useEffect, useState } from 'react'
export default function useIsMobile() {
  const [mobile,setMobile]=useState(()=>window.matchMedia('(max-width: 767px)').matches)
  useEffect(()=>{ const q=window.matchMedia('(max-width: 767px)'); const f=()=>setMobile(q.matches); f(); q.addEventListener('change',f); return ()=>q.removeEventListener('change',f)},[])
  return mobile
}
