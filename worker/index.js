const SERVICE_KEYS = {
  study: "DIFY_STUDY_KEY",
  personal: "DIFY_PERSONAL_KEY",
  design: "DIFY_DESIGN_KEY",
  case: "DIFY_CASE_KEY",
  grading: "DIFY_GRADING_KEY",
};

const inputFormCache = new Map();

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

function publicAnswer(value) {
  return String(value || "")
    .replace(/<think\b[^>]*>[\s\S]*?<\/think>\s*/gi, "")
    .replace(/<think\b[^>]*>[\s\S]*$/gi, "")
    .trim();
}

async function buildInputs(service, apiKey, query, user) {
  let form = inputFormCache.get(service);
  if (!form) {
    try {
      const response = await fetch("https://api.dify.ai/v1/parameters", {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      const result = await response.json();
      form = Array.isArray(result.user_input_form) ? result.user_input_form : [];
      inputFormCache.set(service, form);
    } catch {
      form = [];
    }
  }

  const inputs = { query };
  for (const item of form) {
    const entry = Object.entries(item || {})[0];
    if (!entry) continue;
    const [type, config] = entry;
    const variable = config?.variable;
    if (!variable || variable === "query") continue;
    if (variable === "student_id" || variable === "user_id") {
      inputs[variable] = user;
      continue;
    }
    if (!config.required && (config.default === undefined || config.default === null || config.default === "")) continue;
    if (config.default !== undefined && config.default !== null && config.default !== "") {
      inputs[variable] = config.default;
    } else if (type === "file-list") {
      inputs[variable] = [];
    } else if (type === "select") {
      inputs[variable] = Array.isArray(config.options) && config.options.length ? config.options[0] : "未填写";
    } else if (type === "number") {
      inputs[variable] = Number.isFinite(config.min) ? config.min : 0;
    } else if (type === "checkbox") {
      inputs[variable] = false;
    } else {
      inputs[variable] = "未填写";
    }
  }
  return inputs;
}

function uploadedFileType(file) {
  return String(file.type || "").toLowerCase().startsWith("image/") ? "image" : "document";
}

function supportedStudentWork(file) {
  const extension = String(file.name || "").toLowerCase().split(".").pop();
  return ["pdf", "doc", "docx", "xls", "xlsx", "csv", "txt", "md", "ppt", "pptx", "png", "jpg", "jpeg", "webp", "gif"].includes(extension);
}

async function uploadToDify(apiKey, file, user) {
  const form = new FormData();
  form.append("file", file, file.name);
  form.append("user", user);
  const response = await fetch("https://api.dify.ai/v1/files/upload", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}` },
    body: form,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || !result.id) throw new Error(result.message || `文件 ${file.name} 上传失败。`);
  return {
    transfer_method: "local_file",
    upload_file_id: result.id,
    type: uploadedFileType(file),
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const headers = corsHeaders(request, env);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (url.pathname === "/") return json(request, env, { service: "data-science-course-agent", status: "ok" });
    if (url.pathname === "/api/parameters" && request.method === "GET") {
      const service = url.searchParams.get("service") || "";
      const keyName = SERVICE_KEYS[service];
      if (!keyName) return json(request, env, { error: "未知的课程服务。" }, 400);
      const apiKey = env[keyName];
      if (!apiKey) return json(request, env, { error: "该栏目尚未配置 Dify 密钥。" }, 503);
      try {
        const response = await fetch("https://api.dify.ai/v1/parameters", {
          headers: { "Authorization": `Bearer ${apiKey}` },
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) return json(request, env, { error: result.message || "读取输入字段失败。" }, 502);
        return json(request, env, { user_input_form: result.user_input_form || [] });
      } catch {
        return json(request, env, { error: "暂时无法读取 Dify 输入字段。" }, 502);
      }
    }
    if (url.pathname !== "/api/chat" || request.method !== "POST") {
      return json(request, env, { error: "接口不存在。" }, 404);
    }

    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS || "https://nnn379.github.io")
      .split(",")
      .map((item) => item.trim());
    if (origin && !allowed.includes(origin)) return json(request, env, { error: "当前来源不允许访问。" }, 403);

    let payload;
    let files = [];
    try {
      const contentType = request.headers.get("Content-Type") || "";
      if (contentType.includes("multipart/form-data")) {
        const form = await request.formData();
        payload = Object.fromEntries(["service", "query", "user", "conversation_id"].map((key) => [key, form.get(key) || ""]));
        files = form.getAll("files").filter((item) => item instanceof File);
      } else {
        payload = await request.json();
      }
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
    if (service === "grading" && (files.length < 1 || files.length > 5)) return json(request, env, { error: "请上传 1 至 5 个学生作业文件。" }, 400);
    if (service !== "grading" && files.length) return json(request, env, { error: "当前栏目不接收文件。" }, 400);
    if (files.some((file) => file.size > 15 * 1024 * 1024)) return json(request, env, { error: "单个文件不能超过 15 MB。" }, 400);
    if (files.some((file) => !supportedStudentWork(file))) return json(request, env, { error: "作业文件格式不受支持，请上传文档、表格、演示文稿或图片。" }, 400);

    const apiKey = env[keyName];
    if (!apiKey) return json(request, env, { error: "该栏目尚未配置 Dify 密钥。" }, 503);

    const inputs = await buildInputs(service, apiKey, query, user);
    if (service === "grading") {
      try {
        inputs.student_work = await Promise.all(files.map((file) => uploadToDify(apiKey, file, user)));
      } catch (error) {
        return json(request, env, { error: error.message || "学生作业上传失败。" }, 502);
      }
    }

    let difyResponse;
    try {
      difyResponse = await fetch("https://api.dify.ai/v1/chat-messages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          inputs,
          query,
          response_mode: "blocking",
          conversation_id: String(payload.conversation_id || ""),
          user,
        }),
      });
    } catch {
      return json(request, env, { error: "暂时无法连接 Dify，请稍后重试。" }, 502);
    }

    const result = await difyResponse.json().catch(() => ({}));
    if (!difyResponse.ok) {
      const message = result.message || "Dify 工作流运行失败。";
      return json(request, env, { error: message }, difyResponse.status >= 500 ? 502 : 400);
    }

    return json(request, env, {
      answer: publicAnswer(result.answer),
      conversation_id: result.conversation_id || "",
    });
  },
};
