/**
 * ToolConverter - конвертация MCP tools в формат API
 */

import { Tool } from "@modelcontextprotocol/sdk/types.js";

export class ToolConverter {
  /**
   * Конвертация MCP tools в формат для LLM API
   */
  static convertToolsForAPI(tools: Tool[]): any[] {
    const converted = tools.map((tool) => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    }));

    console.log(
      "[AGENT] Tools converted:",
      JSON.stringify(converted.slice(0, 2), null, 2)
    );

    return converted;
  }
}
