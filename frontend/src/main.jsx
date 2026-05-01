import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { seedDefaults, resetAndReseed } from './api/seedData'
import 'antd/dist/reset.css'
import './index.css'

if (localStorage.getItem('_essar_seeded_v3') && !localStorage.getItem('_essar_seeded_v4')) {
  resetAndReseed()
} else {
  seedDefaults()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
