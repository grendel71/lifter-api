import { Link, NavLink } from "react-router-dom";

interface SiteHeaderProps {
  loggedIn: boolean;
}

export function SiteHeader({ loggedIn }: SiteHeaderProps) {
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
          {loggedIn ? (
            <Link className="site-nav-cta" to="/profile">
              Profile
            </Link>
          ) : (
            <Link className="site-nav-cta" to="/login">
              Log In
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
