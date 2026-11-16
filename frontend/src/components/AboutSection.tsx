export function AboutSection() {
  return (
    <section id="about" className="about-section">
      <h2>How the ranking works</h2>
      <dl className="about-list">
        <div>
          <dt>Total</dt>
          <dd>
            Your total is your best Squat, Bench Press and Deadlift added
            together.
          </dd>
        </div>
        <div>
          <dt>Top 10</dt>
          <dd>The table shows the ten lifters with the highest totals.</dd>
        </div>
        <div>
          <dt>Your lifts</dt>
          <dd>
            Log in, then use the profile page to change your name and lifts. New
            accounts are created from an invite link sent by an admin. The table
            updates at once.
          </dd>
        </div>
      </dl>
    </section>
  );
}
