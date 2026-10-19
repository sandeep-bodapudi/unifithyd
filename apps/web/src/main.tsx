import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import './styles/tokens.css'
import Landing from './landing/Landing'
import { MemberEntry, PolicyPlaceholder } from './pages/Placeholders'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app/*" element={<MemberEntry />} />
        <Route path="/terms" element={<PolicyPlaceholder title="Terms of Service" />} />
        <Route path="/privacy" element={<PolicyPlaceholder title="Privacy Policy" />} />
        <Route path="/refunds" element={<PolicyPlaceholder title="Refund and Cancellation Policy" />} />
        <Route path="*" element={<PolicyPlaceholder title="Page not found" />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
