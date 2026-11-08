import { Link, NavLink } from "react-router-dom";

interface SiteHeaderProps {
  loggedIn: boolean;
}

export function SiteHeader({ loggedIn }: SiteHeaderProps) {
  const ctaTo = loggedIn ? "/profile" : "/login";
  const ctaLabel = loggedIn ? "Profile" : "Log In";

  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <Link className="site-brand" to="/">
          <span className="site-brand-mark" aria-hidden="true">
            ▲
          </span>
          <span>Leaderboard</span>
        </Link>
        <nav className="site-nav" aria-label="Primary">
          <NavLink to="/" end>
            Rankings
          </NavLink>
          <Link to="/#about">About</Link>
          <Link className="site-nav-cta" to={ctaTo}>
            <svg
              className="cta-icon"
              viewBox="0 0 24 24"
              width="20"
              height="20"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 4-6 8-6s8 2 8 6" />
            </svg>
            <span className="cta-label">{ctaLabel}</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}
