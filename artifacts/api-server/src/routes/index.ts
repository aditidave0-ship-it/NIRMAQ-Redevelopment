import { Router, type IRouter } from "express";
import healthRouter from "./health";
import renovaRouter from "./renova";
import authRouter from "./auth";
import opportunitiesRouter from "./opportunities";
import enquiriesRouter from "./enquiries";
import privacyRouter from "./privacy";
import profilesRouter from "./profiles";
import feasibilityRouter from "./feasibility";
import workspaceRouter from "./workspace";
import sandboxBillingRouter from "./sandbox-billing";
import emailJobsRouter from "./email-jobs";
import { standardRateLimit } from "../lib/standard-rate-limit";

const router: IRouter = Router();

router.use(healthRouter);
// Prompt L, Task 1 — the standard tier. Mounted after the health probes
// (readiness must answer when the database is down) and before every other
// router, so all non-health routes get the per-IP + global cap on top of
// their own per-action limits. See lib/standard-rate-limit.ts.
router.use(standardRateLimit);
router.use(renovaRouter);
router.use(authRouter);
router.use(opportunitiesRouter);
router.use(enquiriesRouter);
router.use(privacyRouter);
router.use(profilesRouter);
router.use(feasibilityRouter);
router.use(workspaceRouter);
router.use(sandboxBillingRouter);
router.use(emailJobsRouter);

export default router;
