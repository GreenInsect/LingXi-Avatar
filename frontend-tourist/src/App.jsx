import { useState } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import MainContent from './components/MainContent'
import FloatingAvatar from './components/FloatingAvatar'

export default function App() {
  const [activePage, setActivePage] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--cream)' }}>
      <Navbar
        activePage={activePage}
        onNavigate={setActivePage}
        onMenuToggle={() => setSidebarOpen(v => !v)}
        sidebarOpen={sidebarOpen}
      />
      <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>
        <Sidebar open={sidebarOpen} activePage={activePage} onNavigate={(p) => { setActivePage(p); setSidebarOpen(false) }} />
        <MainContent activePage={activePage} onNavigate={setActivePage} />
      </div>
      <FloatingAvatar open={avatarOpen} onToggle={() => setAvatarOpen(v => !v)} />
    </div>
  )
}
