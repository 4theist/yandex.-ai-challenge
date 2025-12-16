import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "path";

async function testMCPConnection() {
  console.log("[MCP Client] Starting test...\n");

  // Создаем транспорт для подключения к серверу
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["ts-node", path.join(__dirname, "mcpServer.ts")],
  });

  // Создаем клиент
  const client = new Client(
    {
      name: "mcp-test-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  try {
    // Подключаемся к серверу
    console.log("[MCP Client] Connecting to MCP server...");
    await client.connect(transport);
    console.log("[MCP Client] ✓ Connected successfully\n");

    // Получаем список доступных инструментов
    console.log("[MCP Client] Requesting list of tools...");
    const toolsList = await client.listTools();
    console.log(`[MCP Client] ✓ Received ${toolsList.tools.length} tools\n`);

    // Выводим информацию о каждом инструменте
    console.log("=".repeat(60));
    console.log("AVAILABLE MCP TOOLS");
    console.log("=".repeat(60));

    toolsList.tools.forEach((tool, index) => {
      console.log(`\n${index + 1}. ${tool.name}`);
      console.log(`   Description: ${tool.description}`);
      console.log(`   Input Schema:`);
      console.log(`   - Type: ${tool.inputSchema.type}`);

      if (tool.inputSchema.properties) {
        console.log(`   - Properties:`);
        Object.entries(tool.inputSchema.properties).forEach(
          ([key, value]: [string, any]) => {
            const required = tool.inputSchema.required?.includes(key)
              ? " (required)"
              : "";
            console.log(`     • ${key}: ${value.type}${required}`);
            if (value.description) {
              console.log(`       ${value.description}`);
            }
          }
        );
      }
    });

    console.log("\n" + "=".repeat(60));
    console.log(`\n[MCP Client] Test completed successfully!`);
    console.log(
      `[MCP Client] Total tools available: ${toolsList.tools.length}`
    );
  } catch (error: any) {
    console.error("[MCP Client] ✗ Error:", error.message);
    console.error(error);
  } finally {
    // Закрываем соединение
    await client.close();
    console.log("\n[MCP Client] Connection closed");
  }
}

// Запуск теста
testMCPConnection();
