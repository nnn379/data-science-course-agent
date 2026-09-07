const SERVICE_KEYS = {
  study: "DIFY_STUDY_KEY",
  personal: "DIFY_PERSONAL_KEY",
  design: "DIFY_DESIGN_KEY",
  case: "DIFY_CASE_KEY",
  grading: "DIFY_GRADING_KEY",
};

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = (env.ALLOWED_ORIGINS || "https://nnn379.github.io")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : allowed[0],
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function json(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request, env),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (url.pathname === "/") return json(request, env, { service: "data-science-course-agent", status: "ok" });
    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return json(request, env, { error: "接口不存在。" }, 404);
    }

    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS || "https://nnn379.github.io")
      .split(",")
      .map((item) => item.trim());
    if (origin && !allowed.includes(origin)) return json(request, env, { error: "当前来源不允许访问。" }, 403);

    let payload;
    try {
      payload = await request.json();
    } catch {
      return json(request, env, { error: "请求格式不正确。" }, 400);
    }

    const service = String(payload.service || "");
    const query = String(payload.query || "").trim();
    const user = String(payload.user || "").trim();
    const keyName = SERVICE_KEYS[service];
    if (!keyName) return json(request, env, { error: "未知的课程服务。" }, 400);
    if (!query || query.length > 8000) return json(request, env, { error: "请输入 1 至 8000 个字符。" }, 400);
    if (!user || user.length > 128) return json(request, env, { error: "用户标识无效。" }, 400);

    const apiKey = env[keyName];
    if (!apiKey) return json(request, env, { error: "该栏目尚未配置 Dify 密钥。" }, 503);

    const difyResponse = await fetch("https://api.dify.ai/v1/chat-messages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: { query, student_id: user },
        query,
        response_mode: "blocking",
        conversation_id: String(payload.conversation_id || ""),
        user,
      }),
    });

    const result = await difyResponse.json().catch(() => ({}));
    if (!difyResponse.ok) {
      const message = result.message || "Dify 工作流运行失败。";
      return json(request, env, { error: message }, difyResponse.status >= 500 ? 502 : 400);
    }

    return json(request, env, {
      answer: result.answer || "",
      conversation_id: result.conversation_id || "",
    });
  },
};
