import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Local dev: http://localhost:5000/api — set VITE_API_URL in .env for production / hosted API
export const server = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
