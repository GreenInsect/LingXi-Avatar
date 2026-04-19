import { useState, useEffect } from 'react'

interface UseLocationReturn {
  location: string | null
  locationLabel: string
}

export function useLocation(): UseLocationReturn {
  const [location, setLocation] = useState<string | null>(null)
  const [locationLabel, setLocationLabel] = useState('正在获取位置...')

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationLabel('景区内（东门方向）')
      setLocation('景区东门区域')
      return
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const coord = `${pos.coords.latitude.toFixed(4)},${pos.coords.longitude.toFixed(4)}`
        setLocation(coord)
        setLocationLabel('景区内（GPS定位成功）')
      },
      () => {
        setLocationLabel('景区内（东门方向）')
        setLocation('景区东门区域')
      },
      { timeout: 5000 },
    )
  }, [])

  return { location, locationLabel }
}
