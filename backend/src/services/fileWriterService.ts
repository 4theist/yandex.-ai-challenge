import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";

interface SaveFileOptions {
  content: string;
  filename?: string;
  title?: string;
  format?: "md" | "txt" | "json";
}

interface SaveFileResult {
  path: string;
  filename: string;
  size: number;
  createdAt: string;
}

class FileWriterService {
  private readonly SUMMARIES_DIR = path.join(__dirname, "../../data/summaries");

  constructor() {
    this.ensureDirectoryExists();
  }

  /**
   * Создать директорию если не существует
   */
  private async ensureDirectoryExists(): Promise<void> {
    try {
      await fs.mkdir(this.SUMMARIES_DIR, { recursive: true });
      console.log(`[FILE WRITER] Directory ready: ${this.SUMMARIES_DIR}`);
    } catch (error: any) {
      console.error("[FILE WRITER] Failed to create directory:", error.message);
    }
  }

  /**
   * Сохранить файл
   */
  async saveFile(options: SaveFileOptions): Promise<SaveFileResult> {
    const {
      content,
      filename,
      title = "Погодная сводка",
      format = "md",
    } = options;

    try {
      // Генерируем имя файла если не указано
      const finalFilename =
        filename ||
        `summary-${new Date().toISOString().slice(0, 10)}-${uuidv4().slice(
          0,
          8
        )}.${format}`;

      const filePath = path.join(this.SUMMARIES_DIR, finalFilename);

      // Форматируем контент в зависимости от формата
      let finalContent = content;

      if (format === "md") {
        finalContent = this.formatAsMarkdown(content, title);
      } else if (format === "json") {
        finalContent = JSON.stringify(
          {
            title,
            content,
            createdAt: new Date().toISOString(),
          },
          null,
          2
        );
      }

      // Сохраняем файл
      await fs.writeFile(filePath, finalContent, "utf-8");

      const stats = await fs.stat(filePath);

      console.log(
        `[FILE WRITER] Saved: ${finalFilename} (${stats.size} bytes)`
      );

      return {
        path: filePath,
        filename: finalFilename,
        size: stats.size,
        createdAt: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error("[FILE WRITER] Save error:", error.message);
      throw new Error(`Failed to save file: ${error.message}`);
    }
  }

  /**
   * Форматирование контента как Markdown
   */
  private formatAsMarkdown(content: string, title: string): string {
    const now = new Date();
    const dateStr = now.toLocaleDateString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("ru-RU", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return `# ${title}

**Создано:** ${dateStr} ${timeStr}

---

${content}

---

*Сгенерировано автоматически AI Agent*
`;
  }

  /**
   * Получить список сохранённых файлов
   */
  async listFiles(): Promise<string[]> {
    try {
      const files = await fs.readdir(this.SUMMARIES_DIR);
      return files.filter(
        (f) => f.endsWith(".md") || f.endsWith(".txt") || f.endsWith(".json")
      );
    } catch (error: any) {
      console.error("[FILE WRITER] List error:", error.message);
      return [];
    }
  }

  /**
   * Прочитать файл
   */
  async readFile(filename: string): Promise<string> {
    try {
      const filePath = path.join(this.SUMMARIES_DIR, filename);
      return await fs.readFile(filePath, "utf-8");
    } catch (error: any) {
      throw new Error(`Failed to read file: ${error.message}`);
    }
  }

  /**
   * Удалить старые файлы (старше N дней)
   */
  async cleanupOldFiles(daysToKeep: number = 30): Promise<number> {
    try {
      const files = await fs.readdir(this.SUMMARIES_DIR);
      const now = new Date();
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.SUMMARIES_DIR, file);
        const stats = await fs.stat(filePath);
        const fileAge =
          (now.getTime() - stats.mtime.getTime()) / (1000 * 60 * 60 * 24);

        if (fileAge > daysToKeep) {
          await fs.unlink(filePath);
          deletedCount++;
          console.log(`[FILE WRITER] Deleted old file: ${file}`);
        }
      }

      return deletedCount;
    } catch (error: any) {
      console.error("[FILE WRITER] Cleanup error:", error.message);
      return 0;
    }
  }
}

export const fileWriterService = new FileWriterService();
