import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { APP } from '../config'

export default function Live(){
  const navigate=useNavigate()
  const [models,setModels]=useState([])
  const [status,setStatus]=useState('Loading live data…')
  useEffect(()=>{
    if(!APP.liveApiUrl){setStatus('Live API is not configured. Set VITE_LIVE_API_URL in .env.local.');return}
    fetch(APP.liveApiUrl)
      .then(r=>{if(!r.ok)throw Error(`HTTP ${r.status}`);return r.json()})
      .then(data=>{const list=Array.isArray(data)?data:(data.models||[]);setModels(list.filter(x=>(x.status||'public').toLowerCase()==='public'));setStatus('')})
      .catch(e=>setStatus(`Unable to load live data: ${e.message}`))
  },[])
  return <main className="live-page">
    <header className="live-header">
      <button onClick={()=>navigate('/')} className="back-btn">←</button>
      <img src="/assets/your-logo.png" alt={APP.name}/>
      <h1>Live</h1>
    </header>
    {status && <div className="live-status">{status}</div>}
    <section className="live-grid">
      {models.map((m,i)=><article className="live-card" key={m.id||i}>
        <img src={m.image||m.avatar||m.thumbnail} alt={m.name||m.username||'Live'}/>
        <h2>{m.name||m.username||'Live model'}</h2>
        <span>🔴 LIVE</span>
      </article>)}
    </section>
  </main>
}
