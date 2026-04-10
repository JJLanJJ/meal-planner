"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeletePlan({ planId }: { planId: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/plans/${planId}`, { method: "DELETE" });
    router.push("/plans");
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="text-xs text-stone-400 mt-6 block mx-auto hover:text-red-500"
      >
        Delete this plan
      </button>
    );
  }

  return (
    <div className="card p-4 mt-6 text-center">
      <p className="text-sm text-stone-700 mb-3">Delete this plan and all its meals?</p>
      <div className="flex gap-3 justify-center">
        <button
          onClick={() => setConfirming(false)}
          className="text-xs px-4 py-2 rounded-lg border border-stone-200 text-stone-500"
        >
          Cancel
        </button>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs px-4 py-2 rounded-lg text-white"
          style={{ background: "#C65A3A" }}
        >
          {deleting ? "Deleting…" : "Yes, delete"}
        </button>
      </div>
    </div>
  );
}
