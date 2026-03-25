import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { boardStatesTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { GetBoardStateQueryParams, SaveBoardStateBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/state", async (req, res) => {
  const parseResult = GetBoardStateQueryParams.safeParse(req.query);
  if (!parseResult.success) {
    res.status(400).json({ error: "bad_request", message: "Missing repoKey parameter" });
    return;
  }

  const { repoKey } = parseResult.data;

  try {
    const rows = await db
      .select()
      .from(boardStatesTable)
      .where(eq(boardStatesTable.repoKey, repoKey));

    if (rows.length === 0) {
      res.json({
        repoKey,
        columns: [],
        lastUpdated: new Date().toISOString(),
      });
      return;
    }

    const row = rows[0];
    res.json({
      repoKey: row.repoKey,
      columns: row.columns,
      lastUpdated: row.lastUpdated.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get board state");
    res.status(500).json({ error: "internal_error", message: "Failed to retrieve board state" });
  }
});

router.post("/state", async (req, res) => {
  const parseResult = SaveBoardStateBody.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: "bad_request", message: "Invalid board state data" });
    return;
  }

  const { repoKey, columns } = parseResult.data;

  try {
    const now = new Date();
    await db
      .insert(boardStatesTable)
      .values({ repoKey, columns, lastUpdated: now })
      .onConflictDoUpdate({
        target: boardStatesTable.repoKey,
        set: { columns, lastUpdated: now },
      });

    res.json({
      repoKey,
      columns,
      lastUpdated: now.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to save board state");
    res.status(500).json({ error: "internal_error", message: "Failed to save board state" });
  }
});

export default router;
