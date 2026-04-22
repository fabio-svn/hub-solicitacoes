import { Router, type IRouter } from "express";
import healthRouter from "./health";
import formsRouter from "./forms";
import adminRouter from "./admin";
import webhookRouter from "./webhook";

const router: IRouter = Router();

router.use(healthRouter);
router.use(formsRouter);
router.use("/admin", adminRouter);
router.use(webhookRouter);

export default router;
