import { pgTable, text, jsonb, timestamp } from "drizzle-orm/pg-core";

export const boardStatesTable = pgTable("board_states", {
  repoKey: text("repo_key").primaryKey(),
  columns: jsonb("columns").$type<{ columnId: string; issueIds: number[] }[]>().notNull().default([]),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});
