/**
 * @deprecated Используйте import из services/session/
 * Этот файл оставлен для обратной совместимости
 */

export { sessionManager } from "./session/sessionManager";
export type { Message, Summary, SessionConfig, Session } from "./session/types";
export { SessionContextBuilder } from "./session/sessionContextBuilder";
export { SessionStatsCalculator, type SessionStats } from "./session/sessionStatsCalculator";
