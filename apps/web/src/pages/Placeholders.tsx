// Screens that exist so links work while their real content is built.
import { Link } from 'react-router-dom'
import { LogoLockup, Mark } from '../brand/Logo'
import './placeholders.css'

export function MemberEntry() {
  return (
    <main className="entry">
      <div className="entry__card">
        <Mark size={72} />
        <h1>Member app</h1>
        <p className="entry__tag">TRAIN • TRANSFORM • THRIVE</p>
        <p>Booking, check-in and payments are being built. Member login opens soon.</p>
        <Link to="/" className="entry__back">
          Back to the website
        </Link>
      </div>
    </main>
  )
}

export function PolicyPlaceholder({ title }: { title: string }) {
  return (
    <main className="entry">
      <div className="entry__card">
        <LogoLockup height={36} />
        <h1>{title}</h1>
        <p>This page is being prepared and will be published before launch.</p>
        <Link to="/" className="entry__back">
          Back to the website
        </Link>
      </div>
    </main>
  )
}
