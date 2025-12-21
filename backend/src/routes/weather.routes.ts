import express from "express";
import { weatherController } from "../controllers/weatherController";
import { validateCity } from "../middleware/validation";

const router = express.Router();

router.post("/", validateCity, weatherController.getWeather);

router.get("/tools", weatherController.getTools);

export default router;
