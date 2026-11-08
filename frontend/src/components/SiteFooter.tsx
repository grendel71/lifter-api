export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="container site-footer-inner">
        <span>© {new Date().getFullYear()} Powerlifting Leaderboard</span>
        <a href="#top">Back to top</a>
      </div>
    </footer>
  );
}
