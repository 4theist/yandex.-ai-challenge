import { MessageConverter } from "../messageConverter";
import type { LLMMessage } from "../../services/llm/baseLLMService";

describe("MessageConverter", () => {
  const mockLLMMessages: LLMMessage[] = [
    { role: "user", content: "Hello" },
    { role: "assistant", content: "Hi there" },
    { role: "system", content: "System message" },
  ];

  describe("normalize", () => {
    it("should return string as is", () => {
      const input = "Simple string message";
      const result = MessageConverter.normalize(input);

      expect(result).toBe("Simple string message");
    });

    it("should normalize messages with content field", () => {
      const input = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi" },
      ];

      const result = MessageConverter.normalize(input);

      expect(Array.isArray(result)).toBe(true);
      expect((result as LLMMessage[])[0]).toEqual({
        role: "user",
        content: "Hello",
      });
    });

    it("should normalize messages with text field (Yandex format)", () => {
      const input = [
        { role: "user", text: "Hello" },
        { role: "assistant", text: "Hi" },
      ];

      const result = MessageConverter.normalize(input);

      expect(Array.isArray(result)).toBe(true);
      expect((result as LLMMessage[])[0]).toEqual({
        role: "user",
        content: "Hello",
      });
    });

    it("should handle mixed format (content takes priority)", () => {
      const input = [
        { role: "user", content: "Content field", text: "Text field" },
      ];

      const result = MessageConverter.normalize(input);

      expect((result as LLMMessage[])[0].content).toBe("Content field");
    });

    it("should handle empty content/text", () => {
      const input = [{ role: "user" }];

      const result = MessageConverter.normalize(input);

      expect((result as LLMMessage[])[0].content).toBe("");
    });
  });

  describe("toYandexFormat", () => {
    it("should convert LLMMessage to Yandex format (content → text)", () => {
      const result = MessageConverter.toYandexFormat(mockLLMMessages);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ role: "user", text: "Hello" });
      expect(result[1]).toEqual({ role: "assistant", text: "Hi there" });
      expect(result[2]).toEqual({ role: "system", text: "System message" });
    });

    it("should handle empty array", () => {
      const result = MessageConverter.toYandexFormat([]);
      expect(result).toEqual([]);
    });
  });

  describe("toOpenRouterFormat", () => {
    it("should convert LLMMessage to OpenRouter format (content → content)", () => {
      const result = MessageConverter.toOpenRouterFormat(mockLLMMessages);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ role: "user", content: "Hello" });
      expect(result[1]).toEqual({ role: "assistant", content: "Hi there" });
      expect(result[2]).toEqual({ role: "system", content: "System message" });
    });

    it("should handle empty array", () => {
      const result = MessageConverter.toOpenRouterFormat([]);
      expect(result).toEqual([]);
    });
  });

  describe("fromYandexFormat", () => {
    it("should convert Yandex format to LLMMessage (text → content)", () => {
      const yandexMessages = [
        { role: "user" as const, text: "Hello" },
        { role: "assistant" as const, text: "Hi there" },
      ];

      const result = MessageConverter.fromYandexFormat(yandexMessages);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ role: "user", content: "Hello" });
      expect(result[1]).toEqual({ role: "assistant", content: "Hi there" });
    });
  });

  describe("fromOpenRouterFormat", () => {
    it("should convert OpenRouter format to LLMMessage", () => {
      const openRouterMessages = [
        { role: "user" as const, content: "Hello" },
        { role: "assistant" as const, content: "Hi there" },
      ];

      const result = MessageConverter.fromOpenRouterFormat(openRouterMessages);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ role: "user", content: "Hello" });
      expect(result[1]).toEqual({ role: "assistant", content: "Hi there" });
    });
  });

  describe("round-trip conversions", () => {
    it("should maintain data integrity: LLM → Yandex → LLM", () => {
      const original = mockLLMMessages;
      const yandex = MessageConverter.toYandexFormat(original);
      const backToLLM = MessageConverter.fromYandexFormat(yandex);

      expect(backToLLM).toEqual(original);
    });

    it("should maintain data integrity: LLM → OpenRouter → LLM", () => {
      const original = mockLLMMessages;
      const openRouter = MessageConverter.toOpenRouterFormat(original);
      const backToLLM = MessageConverter.fromOpenRouterFormat(openRouter);

      expect(backToLLM).toEqual(original);
    });
  });
});
