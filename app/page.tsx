"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function Home() {
  const router = useRouter();
  const [latestPlanId, setLatestPlanId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/plans")
      .then((res) => res.json())
      .then((plans) => {
        if (plans.length > 0) {
          setLatestPlanId(plans[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (latestPlanId) {
    router.push(`/plan?id=${latestPlanId}`);
    return null;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-20 text-center">
      <h1 className="text-4xl font-bold mb-4">Meal Planner</h1>
      <p className="text-muted text-lg mb-8">
        Input your weekly ingredients and get AI-generated dinner plans with
        step-by-step instructions.
      </p>
      <Link
        href="/ingredients"
        className="inline-block bg-primary text-white px-8 py-3 rounded-lg text-lg font-medium hover:opacity-90 transition-opacity"
      >
        Create Your First Plan
      </Link>
    </div>
  );
}
