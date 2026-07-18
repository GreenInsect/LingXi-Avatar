import { useEffect, useState } from 'react'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import { Toast } from './components/UI'
import { useToast } from './hooks/useToast'
import { getAdminSession, logoutAdmin } from './services/api'
import Dashboard from './pages/Dashboard'
import Report from './pages/Report'
import Conversations from './pages/Conversations'
import Knowledge from './pages/Knowledge'
import Avatar from './pages/Avatar'
import Login from './pages/Login'

const PAGES = {
  dashboard:     Dashboard,
  report:        Report,
  conversations: Conversations,
  knowledge:     Knowledge,
  avatar:        Avatar,
}

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const [adminSession, setAdminSession] = useState(() => getAdminSession())
  const { toast, show: showToast } = useToast()

  const PageComponent = PAGES[activePage] || Dashboard

  useEffect(() => {
    const handleExpired = () => {
      setAdminSession(null)
      showToast('登录已失效，请重新登录', 'error')
    }
    window.addEventListener('admin-session-expired', handleExpired)
    return () => window.removeEventListener('admin-session-expired', handleExpired)
  }, [showToast])

  const handleLogout = () => {
    logoutAdmin()
    setAdminSession(null)
    showToast('已退出登录', 'default')
  }

  if (!adminSession?.access_token) {
    return (
      <>
        <Login onLogin={setAdminSession} showToast={showToast} />
        <Toast message={toast.message} type={toast.type} visible={toast.visible} />
      </>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <div style={{ marginLeft: 210, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Topbar
          activePage={activePage}
          username={adminSession.username}
          onLogout={handleLogout}
        />
        <main style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
          <PageComponent showToast={showToast} />
        </main>
      </div>

      <Toast message={toast.message} type={toast.type} visible={toast.visible} />
    </div>
  )
}
