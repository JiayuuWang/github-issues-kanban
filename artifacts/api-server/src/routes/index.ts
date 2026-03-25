import { Router, type IRouter } from "express";
import healthRouter from "./health";
import githubRouter from "./github";
import boardRouter from "./board";
import githubAdminRouter from "./github-admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/github", githubRouter);
router.use("/board", boardRouter);
router.use("/github-admin", githubAdminRouter);

export default router;
