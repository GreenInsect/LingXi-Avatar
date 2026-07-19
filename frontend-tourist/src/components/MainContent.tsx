import type { PageId } from '../types'
import HomePage from '../pages/HomePage'
import SpotsPage from '../pages/SpotsPage'
import RoutesPage from '../pages/RoutesPage'
import MapPage from '../pages/MapPage'
import ARPage from '../pages/ARPage'
import { NianheWanPage, InfoPage, HistoryPage } from '../pages/OtherPages'

interface MainContentProps {
  activePage: PageId
  onNavigate: (p: PageId) => void
  onOpenAvatar: () => void
  onAROverlayChange: (active: boolean) => void
}

export default function MainContent({
  activePage,
  onNavigate,
  onOpenAvatar,
  onAROverlayChange,
}: MainContentProps) {
  const pages: Record<PageId, React.ReactNode> = {
    home:      <HomePage onNavigate={onNavigate} />,
    spots:     <SpotsPage />,
    routes:    <RoutesPage />,
    map:       <MapPage onOpenAvatar={onOpenAvatar} onAROverlayChange={onAROverlayChange} />,
    ar:        <ARPage onOpenAvatar={onOpenAvatar} onAROverlayChange={onAROverlayChange} />,
    nianhewan: <NianheWanPage />,
    info:      <InfoPage />,
    history:   <HistoryPage />,
  }

  return (
    <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {pages[activePage] ?? pages.home}
    </main>
  )
}
