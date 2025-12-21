import express from "express";
import { mcpController } from "../controllers/mcpController";
import { validateMcpQuery } from "../middleware/validation";

const router = express.Router();

router.get("/tools", mcpController.getTools);

router.post("/pipeline", validateMcpQuery, mcpController.runPipeline);

export default router;
