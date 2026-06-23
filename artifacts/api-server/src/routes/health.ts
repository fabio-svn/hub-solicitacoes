import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { getHealthSnapshot } from "../services/health-monitor";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Readiness: reflete o estado das dependências (banco, R2) coletado pelo health-monitor.
// 503 = "no ar, porém degradado". Um monitor externo (ex.: UptimeRobot) pode acompanhar
// este endpoint. O /healthz acima segue como liveness puro do processo.
router.get("/readyz", (_req, res) => {
  const snap = getHealthSnapshot();
  res.status(snap.ok ? 200 : 503).json(snap);
});

export default router;