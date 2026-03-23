import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
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
