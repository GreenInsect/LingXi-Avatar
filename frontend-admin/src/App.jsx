import { useState } from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import { Toast } from './components/UI'
import { useToast } from './hooks/useToast'
import Dashboard from './pages/Dashboard'
import Report from './pages/Report'
import Conversations from './pages/Conversations'
import Knowledge from './pages/Knowledge'
import Avatar from './pages/Avatar'

const PAGES = {
  dashboard:     Dashboard,
  report:        Report,
  conversations: Conversations,
  knowledge:     Knowledge,
  avatar:        Avatar,
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const { toast, show: showToast } = useToast()

  const PageComponent = PAGES[activePage] || Dashboard

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <div style={{ marginLeft: 210, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar activePage={activePage} />
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <PageComponent showToast={showToast} />
        </main>
      </div>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </div>
  )
}
