import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

// 开发时浏览器会强缓存 favicon；每次加载用新 URL 强制刷新标签页图标
if (import.meta.env.DEV) {
  const href = `/brand-icon.png?t=${Date.now()}`
  document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach((n) => n.remove())
  const icon = document.createElement('link')
  icon.rel = 'icon'
  icon.type = 'image/png'
  icon.href = href
  document.head.appendChild(icon)
  const shortcut = document.createElement('link')
  shortcut.rel = 'shortcut icon'
  shortcut.type = 'image/png'
  shortcut.href = href
  document.head.appendChild(shortcut)
  const apple = document.createElement('link')
  apple.rel = 'apple-touch-icon'
  apple.href = href
  document.head.appendChild(apple)
}
import './index.css'
import { Toaster } from 'react-hot-toast'
import { SiteConfigProvider } from './context/SiteConfigContext.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SiteConfigProvider>
      <App />
      <Toaster position="top-center" />
    </SiteConfigProvider>
  </React.StrictMode>,
)
