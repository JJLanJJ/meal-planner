export interface RecipeRef {
  title: string;
  url: string;
  domain: string;
}

export interface RecipeSearchResult {
  snippet: string;   // passed to Claude as reference context
  refs: RecipeRef[]; // stored with the recipe for display
}

/**
 * Searches Tavily for real recipe content to ground Claude's generation.
 * Returns a snippet for Claude and structured refs for display, or null on failure.
 */
export async function searchRecipes(query: string): Promise<RecipeSearchResult | null> {
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
    const results: { title: string; content: string; url: string }[] = data.results ?? [];
    if (results.length === 0) return null;

    const top = results.slice(0, 3);
    const snippet = top
      .map((r) => `— ${r.title} (${new URL(r.url).hostname})\n${r.content.slice(0, 400)}`)
      .join("\n\n");

    const refs: RecipeRef[] = top.map((r) => ({
      title: r.title,
      url: r.url,
      domain: new URL(r.url).hostname.replace(/^www\./, ""),
    }));

    return { snippet, refs };
  } catch {
    return null;
  }
}

/** Build a Tavily search query for a single meal night. */
export function buildRecipeSearchQuery(
  cuisine: string | null,
  deliveryItems: { name: string; category: string }[],
): string {
  const protein =
    deliveryItems.find((d) => d.category === "meat")?.name ??
    deliveryItems[0]?.name ??
    "";
  return [protein, cuisine, "recipe dinner"].filter(Boolean).join(" ");
}
