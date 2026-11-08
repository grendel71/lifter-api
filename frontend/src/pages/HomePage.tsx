import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { AboutSection } from "../components/AboutSection";
import { LeaderboardTable } from "../components/LeaderboardTable";
import { PageHero } from "../components/PageHero";
import type { LeaderboardEntry } from "../types";

interface HomePageProps {
  entries: LeaderboardEntry[];
  currentUserId: string | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
}

export function HomePage({
  entries,
  currentUserId,
  loading,
  error,
  onRefresh,
}: HomePageProps) {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    document.getElementById(hash.slice(1))?.scrollIntoView?.({ behavior: "smooth" });
  }, [hash]);

  return (
    <>
      <PageHero />
      <main className="container page-stack">
        <LeaderboardTable
          entries={entries}
          currentUserId={currentUserId}
          loading={loading}
          error={error}
          onRefresh={onRefresh}
        />
        <AboutSection />
      </main>
    </>
  );
}
