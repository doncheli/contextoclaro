import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Default to light theme — preferencia del usuario, persistido en localStorage.
const savedTheme = localStorage.getItem('cc_theme')
document.documentElement.setAttribute('data-theme', savedTheme === 'dark' ? 'dark' : 'light')

// Register Service Worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
