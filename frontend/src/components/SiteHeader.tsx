export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container site-header-inner">
        <a className="site-brand" href="#top">
          <span className="site-brand-mark" aria-hidden="true">
            ▲
          </span>
          <span>Leaderboard</span>
        </a>
        <nav className="site-nav" aria-label="Primary">
          <a href="#leaderboard">Rankings</a>
          <a href="#account">Account</a>
          <a href="#about">About</a>
        </nav>
      </div>
    </header>
  );
}
