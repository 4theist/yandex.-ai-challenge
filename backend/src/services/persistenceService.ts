import fs from "fs/promises";
import path from "path";
import { Session } from "./sessionManager";

const DATA_DIR = path.join(__dirname, "../../data/sessions");

export class PersistenceService {
  constructor() {
    this.ensureDataDir();
  }

  /**
   * Создаёт директорию для данных, если её нет
   */
  private async ensureDataDir(): Promise<void> {
    try {
      await fs.access(DATA_DIR);
    } catch {
      await fs.mkdir(DATA_DIR, { recursive: true });
      console.log(`[PERSISTENCE] Created data directory: ${DATA_DIR}`);
    }
  }

  /**
   * Сохранить сессию в JSON-файл
   */
  async saveSession(session: Session): Promise<void> {
    try {
      const filePath = path.join(DATA_DIR, `${session.sessionId}.json`);
      const data = JSON.stringify(session, null, 2);
      await fs.writeFile(filePath, data, "utf-8");
      console.log(`[PERSISTENCE] Saved session: ${session.sessionId}`);
    } catch (error: any) {
      console.error(
        `[PERSISTENCE ERROR] Failed to save session:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Загрузить сессию из JSON-файла
   */
  async loadSession(sessionId: string): Promise<Session | null> {
    try {
      const filePath = path.join(DATA_DIR, `${sessionId}.json`);
      const data = await fs.readFile(filePath, "utf-8");
      const session = JSON.parse(data);

      // Конвертируем строки дат обратно в Date объекты
      session.createdAt = new Date(session.createdAt);
      session.lastActivityAt = new Date(session.lastActivityAt);
      session.messages = session.messages.map((msg: any) => ({
        ...msg,
        timestamp: new Date(msg.timestamp),
      }));
      session.summaries = session.summaries.map((sum: any) => ({
        ...sum,
        createdAt: new Date(sum.createdAt),
      }));

      console.log(`[PERSISTENCE] Loaded session: ${sessionId}`);
      return session;
    } catch (error: any) {
      if (error.code === "ENOENT") {
        return null; // Файл не найден
      }
      console.error(
        `[PERSISTENCE ERROR] Failed to load session:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Загрузить все сессии
   */
  async loadAllSessions(): Promise<Session[]> {
    try {
      await this.ensureDataDir();
      const files = await fs.readdir(DATA_DIR);
      const jsonFiles = files.filter((f) => f.endsWith(".json"));

      const sessions: Session[] = [];
      for (const file of jsonFiles) {
        const sessionId = file.replace(".json", "");
        const session = await this.loadSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }

      console.log(`[PERSISTENCE] Loaded ${sessions.length} sessions`);
      return sessions;
    } catch (error: any) {
      console.error(
        `[PERSISTENCE ERROR] Failed to load all sessions:`,
        error.message
      );
      return [];
    }
  }

  /**
   * Удалить сессию из файловой системы
   */
  async deleteSession(sessionId: string): Promise<void> {
    try {
      const filePath = path.join(DATA_DIR, `${sessionId}.json`);
      await fs.unlink(filePath);
      console.log(`[PERSISTENCE] Deleted session file: ${sessionId}`);
    } catch (error: any) {
      if (error.code === "ENOENT") {
        console.log(`[PERSISTENCE] Session file not found: ${sessionId}`);
        return;
      }
      console.error(
        `[PERSISTENCE ERROR] Failed to delete session:`,
        error.message
      );
      throw error;
    }
  }

  /**
   * Получить список всех sessionId
   */
  async getSessionIds(): Promise<string[]> {
    try {
      await this.ensureDataDir();
      const files = await fs.readdir(DATA_DIR);
      return files
        .filter((f) => f.endsWith(".json"))
        .map((f) => f.replace(".json", ""));
    } catch (error: any) {
      console.error(
        `[PERSISTENCE ERROR] Failed to get session IDs:`,
        error.message
      );
      return [];
    }
  }
}

export const persistenceService = new PersistenceService();
