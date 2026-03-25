import { Router, type IRouter } from "express";
import healthRouter from "./health";
import githubRouter from "./github";
import boardRouter from "./board";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/github", githubRouter);
router.use("/board", boardRouter);

export default router;
