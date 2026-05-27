import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { seedDefaults, resetAndReseed } from './api/seedData'
import 'antd/dist/reset.css'
import './index.css'

// Force reseed with latest demo data
const currentVersion = '_essar_seeded_v10'
const hasLatest = localStorage.getItem(currentVersion)
if (!hasLatest) {
  resetAndReseed()
} else {
  seedDefaults()
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode><App /></React.StrictMode>
)
