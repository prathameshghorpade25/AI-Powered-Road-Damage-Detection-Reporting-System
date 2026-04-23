import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { CivicProvider } from './context/CivicContext'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <CivicProvider>
        <App />
      </CivicProvider>
    </BrowserRouter>
  </StrictMode>,
)
