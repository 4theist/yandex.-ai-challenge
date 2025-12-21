import { Request, Response } from "express";

export const mcpController = {
  /**
   * Получить список всех MCP инструментов
   */
  async getTools(req: Request, res: Response) {
    try {
      console.log("[MCP] Getting available tools...");

      const { ToolOrchestrator } = await import("../mcp/orchestratorAgent");
      const orchestrator = new ToolOrchestrator();

      await orchestrator.connectToServers();
      const tools = await orchestrator.listAllTools();
      await orchestrator.disconnect();

      res.json({
        success: true,
        tools,
        count: tools.length,
      });
    } catch (error: any) {
      console.error("[MCP] Get tools error:", error);
      res.status(500).json({
        success: false,
        error: error.message,
      });
    }
  },

  /**
   * Запустить MCP pipeline
   */
  async runPipeline(req: Request, res: Response) {
    try {
      const {
        query,
        days = 7,
        searchType = "forecasts",
        maxSummaryLength = 300,
        fileFormat = "md",
      } = req.body;

      console.log("[MCP PIPELINE] Starting...", { query, days, searchType });

      const { ToolOrchestrator } = await import("../mcp/orchestratorAgent");
      const orchestrator = new ToolOrchestrator();

      await orchestrator.connectToServers();

      const result = await orchestrator.executePipeline(query, {
        days,
        searchType,
        maxSummaryLength,
        fileFormat,
      });

      await orchestrator.disconnect();

      console.log("[MCP PIPELINE] Completed successfully");

      res.json(result);
    } catch (error: any) {
      console.error("[MCP PIPELINE ERROR]", error);
      res.status(500).json({
        success: false,
        error: error.message,
        details: error.stack,
      });
    }
  },
};
