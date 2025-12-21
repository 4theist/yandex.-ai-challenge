/**
 * Dialog controllers module
 * Управление диалоговыми сессиями разделено на модули по функциональности
 */

export { sessionManagementController } from "./sessionManagementController";
export { sessionMessageController } from "./sessionMessageController";
export { sessionInfoController } from "./sessionInfoController";

/**
 * Комбинированный контроллер для обратной совместимости
 */
export const dialogController = {
  // Session Management
  ...require("./sessionManagementController").sessionManagementController,
  // Message Handling
  ...require("./sessionMessageController").sessionMessageController,
  // Session Info & Operations
  ...require("./sessionInfoController").sessionInfoController,
};
