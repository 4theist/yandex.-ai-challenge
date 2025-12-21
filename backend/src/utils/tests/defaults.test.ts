import { CONFIG } from "../../config/defaults";

describe("CONFIG", () => {
  it("should have all required sections", () => {
    expect(CONFIG.LLM).toBeDefined();
    expect(CONFIG.SESSION).toBeDefined();
    expect(CONFIG.AGENT).toBeDefined();
    expect(CONFIG.API).toBeDefined();
    expect(CONFIG.SHELL).toBeDefined();
    expect(CONFIG.SCHEDULER).toBeDefined();
    expect(CONFIG.LOGGING).toBeDefined();
  });

  it("should have correct LLM defaults", () => {
    expect(CONFIG.LLM.DEFAULT_TEMPERATURE).toBe(0.6);
    expect(CONFIG.LLM.STABLE_TEMPERATURE).toBe(0.3);
    expect(CONFIG.LLM.DEFAULT_MAX_TOKENS).toBe(2000);
  });

  it("should have correct SHELL configuration", () => {
    expect(CONFIG.SHELL.COMMAND_TIMEOUT_MS).toBe(60 * 1000);
    expect(CONFIG.SHELL.MAX_BUFFER_SIZE).toBeGreaterThan(0);
    expect(CONFIG.SHELL.WORKING_DIRECTORY).toBeTruthy();
  });

  it("should have valid timeout values", () => {
    expect(CONFIG.SESSION.TIMEOUT_MS).toBeGreaterThan(0);
    expect(CONFIG.API.REQUEST_TIMEOUT_MS).toBeGreaterThan(0);
    expect(CONFIG.SHELL.COMMAND_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
