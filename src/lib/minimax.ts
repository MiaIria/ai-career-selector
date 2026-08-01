type MiniMaxMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export class MiniMaxConfigurationError extends Error {}

export async function callMiniMax(messages: MiniMaxMessage[]) {
  const apiKey = process.env.MINIMAX_API_KEY;
  const baseUrl = process.env.MINIMAX_BASE_URL?.replace(/\/$/, "");
  const model = process.env.MINIMAX_MODEL ?? "minimax-m3";

  if (!apiKey || !baseUrl) {
    throw new MiniMaxConfigurationError("MiniMax环境变量尚未配置");
  }

  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`MiniMax请求失败（${response.status}）：${detail.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error("MiniMax响应缺少有效内容");
  }
  return content;
}
