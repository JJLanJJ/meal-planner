/**
 * Searches Tavily for real recipe content to ground Claude's generation.
 * Returns a short snippet (title + method notes) from the top results,
 * or null if no API key is set or the search fails.
 */
export async function searchRecipes(query: string): Promise<string | null> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) return null;

  try {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        api_key: key,
        query,
        search_depth: "basic",
        max_results: 3,
        include_answer: false,
        include_raw_content: false,
        // Focus on recipe-heavy domains
        include_domains: [
          "seriouseats.com",
          "taste.com.au",
          "bbcgoodfood.com",
          "theguardian.com",
          "smittenkitchen.com",
          "cooking.nytimes.com",
          "bonappetit.com",
          "delicious.com.au",
          "jamieoliver.com",
        ],
      }),
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const results: { title: string; content: string; url: string }[] =
      data.results ?? [];

    if (results.length === 0) return null;

    return results
      .slice(0, 3)
      .map((r) => `— ${r.title} (${new URL(r.url).hostname})\n${r.content.slice(0, 400)}`)
      .join("\n\n");
  } catch {
    return null;
  }
}

/** Build a Tavily search query for a single meal night. */
export function buildRecipeSearchQuery(
  cuisine: string | null,
  deliveryItems: { name: string; category: string }[],
): string {
  // Pick the first meat/protein, fall back to first item
  const protein =
    deliveryItems.find((d) => d.category === "meat")?.name ??
    deliveryItems[0]?.name ??
    "";

  const parts = [protein, cuisine, "recipe dinner"].filter(Boolean);
  return parts.join(" ");
}
