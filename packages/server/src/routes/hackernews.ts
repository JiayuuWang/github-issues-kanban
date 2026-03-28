import { Router, type IRouter } from "express";
import * as cheerio from "cheerio";

const router: IRouter = Router();

// --- HackerNews Top Stories ---
router.get("/top-stories", async (req, res) => {
  const limit = Math.min(parseInt((req.query.limit as string) || "50", 10), 100);

  try {
    const idsRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    if (!idsRes.ok) {
      res.status(502).json({ error: "hn_error", message: "Failed to fetch HN top stories" });
      return;
    }
    const allIds = (await idsRes.json()) as number[];
    const ids = allIds.slice(0, limit);

    // Fetch stories in parallel (batched)
    const stories = await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (!r.ok) return null;
          return (await r.json()) as any;
        } catch {
          return null;
        }
      })
    );

    const result = stories
      .filter((s): s is any => s != null && s.type === "story" && !s.dead && !s.deleted)
      .map((s) => ({
        id: s.id,
        title: s.title,
        url: s.url || `https://news.ycombinator.com/item?id=${s.id}`,
        score: s.score || 0,
        by: s.by || "",
        time: s.time || 0,
        descendants: s.descendants || 0,
        hn_url: `https://news.ycombinator.com/item?id=${s.id}`,
      }));

    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch HackerNews stories");
    res.status(500).json({ error: "internal_error", message: "Failed to fetch HN stories" });
  }
});

// --- Extract keywords from HN stories for word cloud ---
router.get("/topic-cloud", async (req, res) => {
  try {
    const idsRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    if (!idsRes.ok) {
      res.status(502).json({ error: "hn_error", message: "Failed to fetch HN stories" });
      return;
    }
    const allIds = (await idsRes.json()) as number[];
    const ids = allIds.slice(0, 60);

    const stories = await Promise.all(
      ids.map(async (id) => {
        try {
          const r = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (!r.ok) return null;
          return (await r.json()) as any;
        } catch {
          return null;
        }
      })
    );

    const validStories = stories.filter(
      (s): s is any => s != null && s.type === "story" && !s.dead && !s.deleted && s.title
    );

    // Common stop words to filter out
    const stopWords = new Set([
      "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
      "of", "with", "by", "from", "is", "it", "its", "as", "are", "was",
      "were", "be", "been", "being", "have", "has", "had", "do", "does",
      "did", "will", "would", "could", "should", "may", "might", "can",
      "this", "that", "these", "those", "i", "you", "he", "she", "we",
      "they", "my", "your", "his", "her", "our", "their", "me", "him",
      "us", "them", "what", "which", "who", "whom", "how", "when", "where",
      "why", "all", "each", "every", "both", "few", "more", "most", "other",
      "some", "such", "no", "not", "only", "same", "so", "than", "too",
      "very", "just", "about", "above", "after", "again", "also", "any",
      "because", "before", "between", "into", "out", "up", "down", "if",
      "then", "there", "here", "now", "new", "old", "get", "got", "use",
      "using", "used", "make", "made", "show", "ask", "hn", "vs", "don",
      "via", "over", "one", "two", "first", "last", "next", "need", "way",
      "much", "many", "still", "even", "like", "know", "think", "want",
      "see", "look", "find", "give", "tell", "say", "take", "come", "go",
      "work", "try", "let", "own", "back", "through", "well", "yet",
    ]);

    // Extract words from titles and count frequency
    const wordCounts = new Map<string, { count: number; score: number; stories: string[] }>();

    for (const story of validStories) {
      const title = story.title as string;
      const score = story.score || 1;

      // Extract meaningful words (2+ chars, not numbers-only)
      const words = title
        .replace(/[^\w\s-]/g, " ")
        .split(/\s+/)
        .map((w: string) => w.toLowerCase().replace(/^-+|-+$/g, ""))
        .filter((w: string) => w.length >= 2 && !stopWords.has(w) && !/^\d+$/.test(w));

      for (const word of words) {
        const existing = wordCounts.get(word);
        if (existing) {
          existing.count++;
          existing.score += score;
          if (existing.stories.length < 3) existing.stories.push(title);
        } else {
          wordCounts.set(word, { count: 1, score, stories: [title] });
        }
      }
    }

    // Sort by weighted score (count * avg_score) and take top entries
    const topics = Array.from(wordCounts.entries())
      .filter(([, v]) => v.count >= 2) // Must appear in at least 2 stories
      .map(([word, v]) => ({
        word,
        count: v.count,
        weight: Math.round(v.count * (v.score / v.count)),
        sample_titles: v.stories,
      }))
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 60);

    res.json({
      topics,
      total_stories: validStories.length,
      generated_at: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to generate topic cloud");
    res.status(500).json({ error: "internal_error", message: "Failed to generate topic cloud" });
  }
});

export default router;
