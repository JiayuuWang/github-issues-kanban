import { Router, type IRouter } from "express";
import healthRouter from "./health";
import githubRouter from "./github";
import boardRouter from "./board";
import hackernewsRouter from "./hackernews";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/github", githubRouter);
router.use("/board", boardRouter);
router.use("/hn", hackernewsRouter);

export default router;
