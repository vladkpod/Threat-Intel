import Anthropic from "@anthropic-ai/sdk";
import type { LlmClient } from "./types.js";

export function createAnthropicClient(
  model: string,
  apiKey?: string,
): LlmClient {
  const client = new Anthropic({
    apiKey: apiKey ?? process.env["ANTHROPIC_API_KEY"],
  });

  return {
    async complete(systemPrompt: string, userPrompt: string): Promise<string> {
      const message = await client.messages.create({
        model,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });
      const content = message.content[0];
      if (!content || content.type !== "text") {
        throw new Error(
          `Unexpected LLM response content type: ${content?.type ?? "empty"}`,
        );
      }
      return content.text;
    },
  };
}
