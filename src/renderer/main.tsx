import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './lib/monaco-setup'
import { initTheme } from './stores/theme-store'
import './index.css'

// 渲染前先落地主题，避免首帧主题闪烁
initTheme()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
