const fetch = require("node-fetch");

class AIService {
  static async generateResponse(prompt, context = []) {
    try {
      const response = await fetch("https://text.pollinations.ai/openai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful assistant in a chat room. Keep responses concise and relevant to the conversation.",
            },
            ...context.map((msg) => ({
              role: msg.username === "AI" ? "assistant" : "user",
              content: msg.text,
            })),
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 150,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI service error: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices[0].message.content;
    } catch (error) {
      console.error("AI generation error:", error);
      return "Sorry, I'm having trouble thinking right now. Please try again later.";
    }
  }
}

module.exports = AIService;
