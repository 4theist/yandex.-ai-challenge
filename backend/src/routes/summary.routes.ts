import express from "express";
import { summaryController } from "../controllers/summaryController";

const router = express.Router();

router.post("/retrospective", summaryController.createRetrospective);

router.post("/forecast", summaryController.createForecast);

router.get("/download/:filename", summaryController.downloadFile);

router.get("/list", summaryController.listFiles);

export default router;
