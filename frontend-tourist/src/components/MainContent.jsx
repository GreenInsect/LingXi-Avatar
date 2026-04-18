import HomePage from '../pages/HomePage'
import SpotsPage from '../pages/SpotsPage'
import RoutesPage from '../pages/RoutesPage'
import { NianheWanPage, InfoPage, HistoryPage } from '../pages/OtherPages'

export default function MainContent({ activePage, onNavigate }) {
  const pages = {
    home:      <HomePage onNavigate={onNavigate} />,
    spots:     <SpotsPage />,
    routes:    <RoutesPage />,
    nianhewan: <NianheWanPage />,
    info:      <InfoPage />,
    history:   <HistoryPage />,
  }

  return (
    <main style={{
      flex: 1,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
    }}>
      {pages[activePage] || pages.home}
    </main>
  )
}
