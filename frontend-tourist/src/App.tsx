import { useState } from 'react'
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'
import MainContent from './components/MainContent'
import FloatingAvatar from './components/FloatingAvatar'
import { Live2DStage } from './live2d/Live2DStage.tsx';

export default function App() {
  const [activePage, setActivePage] = useState('home')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  // const [selectedAvatar, setSelectedAvatar] = useState<AvatarManifest>(getAvatarById(defaultAvatarId));


  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', overflow:'hidden', background:'var(--cream)' }}>
      <Navbar
        activePage={activePage}
        onNavigate={setActivePage}
        onMenuToggle={() => setSidebarOpen(v => !v)}
        sidebarOpen={sidebarOpen}
      />
        {/* <Live2DStage
          avatar={selectedAvatar}
          expressionMix={activeExpressionMix}
          parameterOverrides={activeParameterOverrides}
          watermarkVisible={!watermarkVisible}
          transform={stageTransform}
          onTransformChange={setStageTransform}
        />       */}
      <div style={{ flex:1, display:'flex', overflow:'hidden', position:'relative' }}>
        <Sidebar open={sidebarOpen} activePage={activePage} onNavigate={(p: string) => { setActivePage(p); setSidebarOpen(false) }} />
        <MainContent activePage={activePage} onNavigate={setActivePage} />
      </div>
      <FloatingAvatar open={avatarOpen} onToggle={() => setAvatarOpen(v => !v)} />
    </div>
  )
}
