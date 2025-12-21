import express from "express";
import { dialogController } from "../controllers/dialogController";
import {
  validateSessionCreate,
  validateDialogMessage,
} from "../middleware/validation";

const router = express.Router();

router.post("/create", validateSessionCreate, dialogController.createSession);

router.post("/message", validateDialogMessage, dialogController.sendMessage);

router.get("/:sessionId/stats", dialogController.getStats);

router.delete("/:sessionId", dialogController.deleteSession);

router.post("/:sessionId/compress", dialogController.compressSession);

router.get("/sessions", dialogController.getAllSessions);

router.get("/:sessionId/history", dialogController.getHistory);

router.post("/:sessionId/restore", dialogController.restoreSession);

router.get("/:sessionId/export", dialogController.exportSession);

export default router;
