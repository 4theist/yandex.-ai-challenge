import express from "express";
import { forecastController } from "../controllers/forecastController";

const router = express.Router();

router.get("/latest", forecastController.getLatest);

router.get("/history", forecastController.getHistory);

router.get("/config", forecastController.getConfig);

router.post("/config", forecastController.updateConfig);

router.post("/generate-now", forecastController.generateNow);

router.get("/logs", forecastController.getLogs);

router.get("/stats", forecastController.getStats);

export default router;
