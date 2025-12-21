import { ShellExecutor } from "../../mcp/tools/shellExecutor";

describe("ShellExecutor", () => {
  let executor: ShellExecutor;

  beforeEach(() => {
    executor = new ShellExecutor();
  });

  describe("executeCommand", () => {
    it("should execute allowed command successfully", async () => {
      const result = await executor.executeCommand("node --version");

      expect(result.success).toBe(true);
      expect(result.exitCode).toBe(0);
      expect(result.output).toMatch(/v\d+\.\d+\.\d+/);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it("should block unsafe command", async () => {
      const result = await executor.executeCommand("rm -rf /");

      expect(result.success).toBe(false);
      expect(result.exitCode).toBe(-1);
      expect(result.error).toContain("Команда не разрешена");
    });
  });

  describe("getAllowedCommands", () => {
    it("should return list of allowed commands", () => {
      const commands = executor.getAllowedCommands();

      expect(Array.isArray(commands)).toBe(true);
      expect(commands).toContain("npm test");
      expect(commands).toContain("git status");
      expect(commands.length).toBeGreaterThan(0);
    });
  });
});
