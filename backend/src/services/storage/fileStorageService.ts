import fs from "fs/promises";
import path from "path";

export class FileStorageService<T = any> {
  constructor(private storageDir: string) { }

  /**
   * Инициализация хранилища (создание директории)
   */
  async initialize(): Promise<void> {
    try {
      await fs.access(this.storageDir);
    } catch {
      await fs.mkdir(this.storageDir, { recursive: true });
      console.log(`[STORAGE] Directory created: ${this.storageDir}`);
    }
  }

  /**
   * Сохранить объект в файл (JSON)
   */
  async save(filename: string, data: T): Promise<void> {
    await this.initialize();
    const filePath = path.join(this.storageDir, filename);
    const jsonData = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, jsonData, "utf-8");
  }

  /**
   * Загрузить объект из файла (JSON)
   */
  async load(filename: string): Promise<T | null> {
    try {
      const filePath = path.join(this.storageDir, filename);
      const content = await fs.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      return null;
    }
  }

  /**
   * Получить список всех файлов в хранилище
   */
  async listFiles(pattern?: RegExp): Promise<string[]> {
    try {
      await this.initialize();
      const files = await fs.readdir(this.storageDir);
      return pattern ? files.filter((f) => pattern.test(f)) : files;
    } catch (error) {
      return [];
    }
  }

  /**
   * Загрузить все объекты из директории
   */
  async loadAll(pattern?: RegExp): Promise<T[]> {
    const files = await this.listFiles(pattern);
    const results: T[] = [];

    for (const file of files) {
      const data = await this.load(file);
      if (data) results.push(data);
    }

    return results;
  }

  /**
   * Удалить файл
   */
  async delete(filename: string): Promise<void> {
    const filePath = path.join(this.storageDir, filename);
    await fs.unlink(filePath);
  }

  /**
   * Проверить существование файла
   */
  async exists(filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.storageDir, filename);
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Получить полный путь к файлу
   */
  getFilePath(filename: string): string {
    return path.join(this.storageDir, filename);
  }

  /**
   * Очистка старых файлов
   */
  async cleanup(maxAgeMs: number): Promise<number> {
    const files = await this.listFiles();
    const now = Date.now();
    let deletedCount = 0;

    for (const file of files) {
      const filePath = this.getFilePath(file);
      const stats = await fs.stat(filePath);
      const age = now - stats.mtimeMs;

      if (age > maxAgeMs) {
        await fs.unlink(filePath);
        deletedCount++;
      }
    }

    return deletedCount;
  }
}
