import { exec } from "child_process";
import { promisify } from "util";
import { logger } from "../../utils/logger";
import { CONFIG } from "../../config/defaults";

const execAsync = promisify(exec);

export interface CommandResult {
  success: boolean;
  command: string;
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
}

/**
 * Whitelist разрешенных команд для безопасности
 */
const ALLOWED_COMMANDS = [
  "npm test",
  "npm run test",
  "npm run test:unit",
  "npm run test:integration",
  "npm run build",
  "pm2 status",
  "pm2 list",
  "pm2 logs --lines 20",
  "git status",
  "git log -1",
  "git log -5 --oneline",
  "git branch",
  "df -h",
  "free -m",
  "uptime",
  "node --version",
  "npm --version",
  "pwd",
  "ls -la",
];

export class ShellExecutor {
  private workingDirectory: string;
  private timeout: number;
  private maxBuffer: number;

  constructor(
    workingDirectory: string = CONFIG.SHELL.WORKING_DIRECTORY,
    timeout: number = CONFIG.SHELL.COMMAND_TIMEOUT_MS,
    maxBuffer: number = CONFIG.SHELL.MAX_BUFFER_SIZE
  ) {
    this.workingDirectory = workingDirectory;
    this.timeout = timeout;
    this.maxBuffer = maxBuffer;

    logger.info(
      "ShellExecutor",
      `Initialized: cwd=${workingDirectory}, timeout=${timeout}ms`
    );
  }

  /**
   * Проверка команды на соответствие whitelist
   */
  private isCommandAllowed(command: string): boolean {
    const trimmedCommand = command.trim();
    return ALLOWED_COMMANDS.some((allowed) =>
      trimmedCommand.startsWith(allowed)
    );
  }

  /**
   * Выполнение shell команды с проверкой безопасности
   */
  async executeCommand(
    command: string,
    customWorkDir?: string
  ): Promise<CommandResult> {
    const startTime = Date.now();
    const trimmedCommand = command.trim();

    logger.info("ShellExecutor", `Executing command: ${trimmedCommand}`);

    // Проверка безопасности
    if (!this.isCommandAllowed(trimmedCommand)) {
      logger.warn("ShellExecutor", `Blocked unsafe command: ${trimmedCommand}`);
      return {
        success: false,
        command: trimmedCommand,
        output: "",
        error: `❌ Команда не разрешена. Разрешены только: ${ALLOWED_COMMANDS.join(
          ", "
        )}`,
        exitCode: -1,
        executionTime: Date.now() - startTime,
      };
    }

    try {
      const { stdout, stderr } = await execAsync(trimmedCommand, {
        cwd: this.workingDirectory,
        timeout: this.timeout,
        maxBuffer: this.maxBuffer,
        env: { ...process.env, FORCE_COLOR: "0" },
      });

      const executionTime = Date.now() - startTime;
      const output = stdout.trim();
      const errorOutput = stderr.trim();
      logger.info("ShellExecutor", `Command output: "${output}"`, {
        stdout: stdout,
        stderr: stderr,
      });
      logger.info("ShellExecutor", `Command completed in ${executionTime}ms`, {
        command: trimmedCommand,
        exitCode: 0,
      });

      return {
        success: true,
        command: trimmedCommand,
        output: output || errorOutput || "Command executed successfully",
        exitCode: 0,
        executionTime,
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      logger.error("ShellExecutor", `Command failed: ${error.message}`, error);

      return {
        success: false,
        command: trimmedCommand,
        output: error.stdout?.trim() || "",
        error: error.stderr?.trim() || error.message || "Unknown error",
        exitCode: error.code || 1,
        executionTime,
      };
    }
  }

  /**
   * Получить список разрешенных команд
   */
  getAllowedCommands(): string[] {
    return [...ALLOWED_COMMANDS];
  }
}

export const shellExecutor = new ShellExecutor();
