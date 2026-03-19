import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'CineBot', description: 'Recomendaciones de películas personalizadas' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="es"><body>{children}</body></html>
}
