const roles = {
  student: {
    name: "学生端", english: "FOR STUDENTS", numeral: "01", photo: "assets/student-spring.jpg",
    desc: "从问题出发，在理解、练习与复盘中建立自己的知识地图。",
    services: [
      { id: "study", mark: "伴", name: "智能伴学中心", desc: "概念答疑、学习指导与课程陪伴", greeting: "你好，我是你的数据科学课程伙伴。可以把不理解的概念、代码或题目发给我，我们一起把问题拆开来看。", prompts: ["用生活中的例子解释什么是数据科学", "相关性和因果关系有什么区别？", "带我完成一次探索性数据分析", "帮我梳理本章的知识脉络"], reply: "这个问题很适合从一个具体情境切入。我们可以先明确要回答的问题，再观察数据中有哪些变量，最后选择合适的方法验证想法。告诉我你正在学习的章节，我会按你的进度一步步展开。" },
      { id: "personal", mark: "学", name: "个性化学习", desc: "制定计划、巩固薄弱点与跟踪进度", greeting: "欢迎来到个性化学习空间。告诉我你的基础、目标和每周可投入的时间，我会和你一起制定一份真正能执行的学习计划。", prompts: ["为零基础学生制定两周学习计划", "我应该先学习 Python 还是统计学？", "帮我诊断目前的知识薄弱点", "推荐一个适合入门练习的数据集"], reply: "可以。为了让计划更贴合你，我会把学习内容拆成短任务，并安排练习与复盘节点。你可以先告诉我目标、目前基础，以及一周大约能投入多少小时。" }
    ]
  },
  teacher: {
    name: "教师端", english: "FOR EDUCATORS", numeral: "02", photo: "assets/campus-dusk.png",
    desc: "把经验沉淀为设计，让备课、案例与反馈更从容、更有依据。",
    services: [
      { id: "design", mark: "教", name: "教学设计辅助", desc: "教学目标、课堂活动与评价设计", greeting: "老师，您好。请告诉我课时、学生基础与本节主题，我可以协助梳理教学目标、课堂活动和评价任务。", prompts: ["设计一节数据可视化课堂活动", "帮我拟定本周的教学目标", "如何向零基础学生讲解过拟合？", "生成一份 90 分钟课程流程"], reply: "我会从“学习目标—课堂活动—学习证据”三个环节组织方案。请补充课时长度、学生基础和知识点范围，我会生成一份可直接调整使用的教学设计。" },
      { id: "case", mark: "例", name: "课程案例生成", desc: "真实情境案例、练习与讨论问题", greeting: "这里可以把抽象知识变成真实问题。给我一个知识点或行业情境，我会生成包含背景、任务、数据字段与讨论问题的课程案例。", prompts: ["生成一个线性回归的商业案例", "设计一份数据清洗课堂练习", "给出一个适合分组讨论的伦理案例", "生成 5 道分类模型练习题"], reply: "好的。我可以围绕课程主题，补齐案例背景、学习任务、数据字段建议和课堂讨论问题。告诉我学生年级、使用时长，以及是否需要参考答案即可。" },
      { id: "grading", mark: "评", name: "作业批改辅助", desc: "依据量规分析作业并形成反馈", greeting: "请提供作业要求、评分量规或学生答案。我会按照明确维度分析完成情况，并给出具体、可行动的反馈建议。", prompts: ["生成数据分析报告的评分量规", "如何评价学生的建模过程？", "帮我写一段形成性评价反馈", "列出常见的数据分析作业问题"], reply: "有效反馈应包含表现证据、问题影响和下一步建议。你可以粘贴作业片段与评分标准，我会逐项分析，并保留教师最终判断的位置。" }
    ]
  }
};

const app = document.querySelector("#app");
let isSending = false;
let selectedFiles = [];
const MAX_GRADING_FILES = 5;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const HISTORY_TTL = 3 * 24 * 60 * 60 * 1000;
const ACCOUNTS_KEY = "ds-course-agent-accounts-v1";
const SESSION_KEY = "ds-course-agent-session-v1";

function brand(isLight = false) {
  return `<div class="brand ${isLight ? "brand--light" : ""}"><span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i><i></i></span><span><strong>数据科学导论</strong><small>INTRODUCTION TO DATA SCIENCE</small></span></div>`;
}

function login(roleId) {
  const role = roles[roleId];
  if (!role) { landing(); return; }
  document.title = "登录 · 数据科学导论";
  app.innerHTML = `<main class="login-page"><div class="login-photo" aria-hidden="true"></div><section class="login-card">
    ${brand()}<p class="login-kicker">${role.english} · SECURE ENTRY</p><h1>进入${role.name}</h1><p class="login-intro">使用用户名和密码进入课程智能体。首次使用时，系统会创建该唯一用户名。</p>
    <form id="login-form" class="login-form"><label>用户名<input id="login-username" name="username" autocomplete="username" maxlength="32" placeholder="3—32 位用户名" required></label><label>密码<input id="login-password" name="password" type="password" autocomplete="current-password" minlength="6" maxlength="128" placeholder="至少 6 位" required></label><p id="login-message" class="login-message">登录后将为你保留近三天的对话与学习路径。</p><button type="submit">登录 / 首次创建 <span>→</span></button></form>
    <p class="login-foot">仅需用户名与密码 · 用户名在本浏览器中唯一</p>
  </section></main>`;
  document.querySelector("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = document.querySelector("#login-username").value.trim();
    const password = document.querySelector("#login-password").value;
    const note = document.querySelector("#login-message");
    if (!/^[\u4e00-\u9fa5a-zA-Z0-9_-]{3,32}$/.test(username)) { note.textContent = "用户名需为 3—32 位中文、字母、数字、下划线或连字符。"; note.classList.add("warning"); return; }
    if (password.length < 6) { note.textContent = "密码至少需要 6 位。"; note.classList.add("warning"); return; }
    const submit = event.currentTarget.querySelector("button");
    submit.disabled = true;
    try {
      const result = await signIn(username, password);
      if (!result.ok) { note.textContent = result.message; note.classList.add("warning"); return; }
      workspace(roleId);
    } catch { note.textContent = "暂时无法读取本地账户信息，请检查浏览器存储权限。"; note.classList.add("warning"); }
    finally { submit.disabled = false; }
  });
}

function landing() {
  document.title = "数据科学导论 · 课程智能体";
  app.innerHTML = `<main class="landing">
    <div class="landing-photo" aria-hidden="true"></div>
    <header class="landing-header">${brand(true)}<span class="header-note">课程智能体服务平台</span></header>
    <section class="landing-copy"><p class="kicker"><span></span> 数据 · 方法 · 真实世界</p><h1>让每一次提问，<br><em>都有学习发生。</em></h1><p class="intro">从校园出发，在数据中理解世界。请选择你的身份，进入相应的课程支持空间。</p><span class="term">2026 · AUTUMN</span></section>
    <section class="role-panel" aria-label="选择身份"><div class="role-panel-heading"><span>选择你的身份</span><small>CHOOSE YOUR ROLE</small></div><div class="role-list">
      ${Object.entries(roles).map(([id, role]) => `<button class="role-card role-card--${id}" data-role="${id}" aria-label="进入${role.name}"><span class="role-image" style="background-image:url('${role.photo}')"></span><span class="role-shade"></span><span class="role-number">${role.numeral}</span><span class="role-content"><small>${role.english}</small><strong>${role.name}</strong><span>${role.desc}</span><b>进入课程空间 <i>↗</i></b></span></button>`).join("")}
    </div></section>
    <footer class="landing-footer"><span>DATA SCIENCE · LEARN WITH CONTEXT</span><span>以数据为舟，向问题深处</span></footer>
  </main>`;
  document.querySelectorAll("[data-role]").forEach((button) => button.addEventListener("click", () => login(button.dataset.role)));
}

function workspace(roleId, serviceId, view = "chat") {
  if (!getCurrentUser()) { login(roleId); return; }
  const role = roles[roleId];
  const service = role.services.find((item) => item.id === serviceId) || role.services[0];
  const apiUrl = window.COURSE_AGENT_CONFIG?.apiUrl?.trim();
  isSending = false;
  selectedFiles = [];
  document.title = `${service.name} · 数据科学导论`;
  app.innerHTML = `<main class="workspace workspace--${roleId}">
    <aside class="sidebar"><div class="sidebar-photo" style="background-image:url('${role.photo}')" aria-hidden="true"></div><div class="sidebar-shade" aria-hidden="true"></div><div class="sidebar-inner">
      ${brand(true)}<button class="back" type="button"><span>←</span> 返回身份选择</button>
      <div class="role-heading"><small>${role.english}</small><h2>${role.name}</h2><p>${role.desc}</p></div>
      <div class="nav-label"><span>课程服务</span><small>${String(role.services.length).padStart(2, "0")}</small></div>
      <nav class="service-nav" aria-label="智能体服务">${role.services.map((item) => `<button class="service-item ${view === "chat" && item.id === service.id ? "active" : ""}" data-service="${item.id}"><b>${item.mark}</b><span><strong>${item.name}</strong><small>${item.desc}</small></span><i>→</i></button>`).join("")}</nav>
      ${roleId === "student" ? `<div class="nav-label nav-label--path"><span>学习档案</span><small>03 DAYS</small></div><button class="learning-path-link ${view === "path" ? "active" : ""}" data-learning-path><b>路</b><span><strong>用户学习路径</strong><small>查看近期知识学习轨迹</small></span><i>→</i></button>` : ""}
      <div class="sidebar-foot"><span>DS · COURSE AGENT</span><small>Powered by Dify workflow</small></div>
    </div></aside>
    <section class="content"><header class="content-header"><button class="mobile-menu" aria-label="打开服务菜单">☰</button><div><p>${role.name} / COURSE SERVICE</p><h1>${view === "path" ? "用户学习路径" : service.name}</h1></div><div class="header-actions">${view === "chat" ? `<button class="reset-chat" type="button" title="清除当前栏目的对话">重新开始</button>` : ""}<span class="current-user">${escapeHtml(getCurrentUser())}</span><button class="logout" type="button">退出</button><div class="agent-state ${apiUrl ? "connected" : ""}"><i></i><span>${apiUrl ? "Dify 服务已连接" : "界面演示模式"}</span></div></div></header>${view === "path" ? learningPath() : demoChat(service)}</section>
    <button class="sidebar-mask" aria-label="关闭服务菜单"></button>
  </main>`;
  bindWorkspace(roleId, service, view);
}

function demoChat(service) {
  const history = getChatHistory(service.id);
  const upload = service.id === "grading" ? `<div class="upload-area"><input id="file-input" type="file" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.ppt,.pptx,.png,.jpg,.jpeg,.webp,.gif" hidden><button class="upload-button" id="upload-button" type="button"><span>＋</span><b>上传学生作业</b><small>支持文档或图片，最多 5 个文件</small></button><div class="file-list" id="file-list"></div></div>` : "";
  const savedMessages = history.map((message) => renderHistoryMessage(message, service)).join("");
  const starters = history.length ? "" : `<section class="starter-section"><div class="starter-heading"><span>从这里开始</span><small>你也可以直接输入自己的问题</small></div><div class="question-grid">${service.prompts.map((prompt) => `<button class="prompt">${prompt}<i>↗</i></button>`).join("")}</div></section>`;
  return `<div class="chat-shell"><div class="messages" id="messages"><div class="date-rule"><span>${history.length ? "已保存的对话" : "今天"}</span></div><div class="assistant-row"><div class="avatar">${service.mark}</div><div class="message-group"><span class="sender">${service.name}</span><div class="bubble assistant-bubble"><p>${service.greeting}</p></div></div></div>${savedMessages}${starters}<div id="typing" class="typing"><span></span><span></span><span></span></div></div><div class="composer-wrap">${upload}<form class="composer composer--query-only" id="form"><textarea id="input" rows="1" placeholder="${service.id === "grading" ? "输入作业要求、评分标准或批改重点…" : "输入你的问题，按 Enter 发送…"}"></textarea><button class="send" type="submit" aria-label="发送问题">↑</button></form><p id="composer-note">${service.id === "grading" ? "提交前请上传学生作业；文件仅用于本次 Dify 工作流处理。" : "智能体的回答仅作为学习与教学参考，请结合课程要求进行判断。"}</p></div></div>`;
}

function learningPath() {
  const events = getLearningEvents();
  const serviceNames = Object.fromEntries(roles.student.services.map((service) => [service.id, service.name]));
  const nodes = events.length ? events.map((event, index) => `<article class="path-node"><span class="path-index">${String(index + 1).padStart(2, "0")}</span><div><small>${formatPathTime(event.createdAt)} · ${serviceNames[event.serviceId] || "学习记录"}</small><h2>${escapeHtml(event.topic)}</h2><p>${index === 0 ? "从这次提问开始建立学习线索。" : "基于最近的提问，继续延展知识网络。"}</p></div></article>`).join("") : `<div class="path-empty"><span>◇</span><h2>学习路径将从第一次提问开始</h2><p>在“智能伴学中心”或“个性化学习”中提问后，系统会保留近三天的知识学习轨迹。</p><button type="button" data-start-learning>去智能伴学中心</button></div>`;
  return `<section class="learning-path"><div class="path-hero"><p>RECENT LEARNING · 03 DAYS</p><h1>${escapeHtml(getCurrentUser())} 的知识学习路径</h1><span>根据近三天在学生端的提问自动整理，共记录 ${events.length} 个学习节点。</span></div><div class="path-line" aria-label="最近知识学习路径">${nodes}</div><p class="path-note">仅保留近三天记录；超过期限的对话和学习节点会自动清除。</p></section>`;
}

function formatPathTime(value) {
  return new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function renderHistoryMessage(message, service) {
  if (message.role === "user") return `<div class="user-row"><div class="bubble user-bubble">${formatText(message.content)}</div></div>`;
  return `<div class="assistant-row"><div class="avatar">${service.mark}</div><div class="message-group"><span class="sender">${service.name}</span><div class="bubble assistant-bubble"><p>${formatText(message.content)}</p></div></div></div>`;
}

function bindWorkspace(roleId, service, view) {
  document.querySelector(".back").addEventListener("click", landing);
  document.querySelectorAll("[data-service]").forEach((button) => button.addEventListener("click", () => workspace(roleId, button.dataset.service)));
  document.querySelector("[data-learning-path]")?.addEventListener("click", () => workspace(roleId, service.id, "path"));
  document.querySelector(".logout").addEventListener("click", () => { signOut(); landing(); });
  const layout = document.querySelector(".workspace");
  const menu = document.querySelector(".mobile-menu");
  const mask = document.querySelector(".sidebar-mask");
  menu.addEventListener("click", () => layout.classList.add("sidebar-open"));
  mask.addEventListener("click", () => layout.classList.remove("sidebar-open"));
  document.querySelector(".reset-chat")?.addEventListener("click", () => {
    clearConversation(service.id);
    workspace(roleId, service.id);
  });
  document.querySelector("[data-start-learning]")?.addEventListener("click", () => workspace("student", "study"));
  const form = document.querySelector("#form");
  if (!form) return;
  const input = document.querySelector("#input");
  if (service.id === "grading") bindFileUpload();
  document.querySelectorAll(".prompt").forEach((button) => button.addEventListener("click", () => ask(button.textContent.replace("↗", "").trim(), service)));
  form.addEventListener("submit", (event) => { event.preventDefault(); if (!input.value.trim()) return; ask(input.value.trim(), service); input.value = ""; });
  input.addEventListener("keydown", (event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
  const messages = document.querySelector("#messages");
  requestAnimationFrame(() => { messages.scrollTop = messages.scrollHeight; });
}

async function ask(question, service) {
  if (isSending) return;
  if (service.id === "grading" && selectedFiles.length === 0) {
    const note = document.querySelector("#composer-note");
    note.textContent = "请先上传需要批改的学生作业文件。";
    note.classList.add("warning");
    document.querySelector("#upload-button")?.focus();
    return;
  }
  isSending = true;
  const messages = document.querySelector("#messages");
  document.querySelector(".starter-section")?.remove();
  const user = document.createElement("div");
  user.className = "user-row";
  user.innerHTML = `<div class="bubble user-bubble">${escapeHtml(question)}</div>`;
  const typing = document.querySelector("#typing");
  messages.insertBefore(user, typing);
  appendChatHistory(service.id, "user", question);
  const input = document.querySelector("#input");
  const send = document.querySelector(".send");
  input.disabled = true;
  send.disabled = true;
  typing.classList.add("show");
  messages.scrollTop = messages.scrollHeight;
  try {
    const filesForRequest = [...selectedFiles];
    const reply = await getReply(question, service, filesForRequest);
    typing.classList.remove("show");
    const answer = document.createElement("div");
    answer.className = "assistant-row";
    answer.innerHTML = `<div class="avatar">${service.mark}</div><div class="message-group"><span class="sender">${service.name}</span><div class="bubble assistant-bubble"><p>${formatText(reply)}</p></div></div>`;
    messages.insertBefore(answer, typing);
    appendChatHistory(service.id, "assistant", reply);
    if (service.id === "grading") {
      selectedFiles = [];
      renderSelectedFiles();
    }
    messages.scrollTop = messages.scrollHeight;
  } catch (error) {
    typing.classList.remove("show");
    const answer = document.createElement("div");
    answer.className = "assistant-row";
    answer.innerHTML = `<div class="avatar">${service.mark}</div><div class="message-group"><span class="sender">${service.name}</span><div class="bubble assistant-bubble error-bubble"><p>${escapeHtml(error.message || "服务暂时不可用，请稍后重试。")}</p></div></div>`;
    messages.insertBefore(answer, typing);
  } finally {
    isSending = false;
    input.disabled = false;
    send.disabled = false;
    input.focus();
    messages.scrollTop = messages.scrollHeight;
  }
}

async function getReply(question, service, files = []) {
  const apiUrl = window.COURSE_AGENT_CONFIG?.apiUrl?.trim();
  if (!apiUrl) {
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    return service.reply;
  }

  const visitorId = getVisitorId();
  const payload = {
      service: service.id,
      query: question,
      user: visitorId,
      conversation_id: getConversation(service.id),
  };
  const options = { method: "POST" };
  if (service.id === "grading") {
    const form = new FormData();
    Object.entries(payload).forEach(([key, value]) => form.append(key, value));
    files.forEach((file) => form.append("files", file, file.name));
    options.body = form;
  } else {
    options.headers = { "Content-Type": "application/json" };
    options.body = JSON.stringify(payload);
  }
  const response = await fetch(`${apiUrl.replace(/\/$/, "")}/api/chat`, options);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Dify 服务暂时不可用，请稍后重试。");
  if (result.conversation_id) saveConversation(service.id, result.conversation_id);
  return result.answer || "本次运行没有返回文字内容。";
}

function bindFileUpload() {
  const input = document.querySelector("#file-input");
  const button = document.querySelector("#upload-button");
  button.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    const incoming = Array.from(input.files || []);
    const accepted = incoming.filter((file) => file.size <= MAX_FILE_BYTES);
    selectedFiles = [...selectedFiles, ...accepted].slice(0, MAX_GRADING_FILES);
    input.value = "";
    renderSelectedFiles();
    const note = document.querySelector("#composer-note");
    if (incoming.some((file) => file.size > MAX_FILE_BYTES)) {
      note.textContent = "单个文件不能超过 15 MB，超限文件未添加。";
      note.classList.add("warning");
    } else if (selectedFiles.length) {
      note.textContent = `已选择 ${selectedFiles.length} 个文件，提交后将用于本次批改。`;
      note.classList.remove("warning");
    }
  });
}

function renderSelectedFiles() {
  const list = document.querySelector("#file-list");
  if (!list) return;
  list.innerHTML = selectedFiles.map((file, index) => `<div class="file-chip"><span aria-hidden="true">文</span><b>${escapeHtml(file.name)}</b><small>${formatFileSize(file.size)}</small><button type="button" data-remove-file="${index}" aria-label="移除文件">×</button></div>`).join("");
  list.querySelectorAll("[data-remove-file]").forEach((button) => button.addEventListener("click", () => {
    selectedFiles.splice(Number(button.dataset.removeFile), 1);
    renderSelectedFiles();
    const note = document.querySelector("#composer-note");
    note.textContent = selectedFiles.length ? `已选择 ${selectedFiles.length} 个文件，提交后将用于本次批改。` : "提交前请上传学生作业；文件仅用于本次 Dify 工作流处理。";
    note.classList.remove("warning");
  }));
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function accountKey(suffix) { return `ds-course-agent-${encodeURIComponent(getCurrentUser() || "guest")}-${suffix}`; }

function getCurrentUser() { return localStorage.getItem(SESSION_KEY) || ""; }

function getAccounts() {
  try { const accounts = JSON.parse(localStorage.getItem(ACCOUNTS_KEY) || "{}"); return accounts && typeof accounts === "object" ? accounts : {}; }
  catch { return {}; }
}

async function passwordHash(password) {
  if (!self.crypto?.subtle) return `plain:${password}`;
  const bytes = new TextEncoder().encode(password);
  const digest = await self.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

async function signIn(username, password) {
  const id = username.toLocaleLowerCase("zh-CN");
  const accounts = getAccounts();
  const hash = await passwordHash(password);
  if (accounts[id] && accounts[id].passwordHash !== hash) return { ok: false, message: "用户名或密码不正确。" };
  if (!accounts[id]) {
    accounts[id] = { username, passwordHash: hash, createdAt: Date.now() };
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
  }
  localStorage.setItem(SESSION_KEY, id);
  return { ok: true };
}

function signOut() { localStorage.removeItem(SESSION_KEY); }

function getVisitorId() { return getCurrentUser(); }

function getConversation(serviceId) {
  try {
    const saved = JSON.parse(localStorage.getItem(accountKey(`conversation-${serviceId}`)) || "null");
    if (saved?.id && Date.now() - saved.updatedAt < HISTORY_TTL) return saved.id;
  } catch { /* A malformed or expired identifier starts a fresh Dify conversation. */ }
  localStorage.removeItem(accountKey(`conversation-${serviceId}`));
  return "";
}

function saveConversation(serviceId, conversationId) {
  localStorage.setItem(accountKey(`conversation-${serviceId}`), JSON.stringify({ id: conversationId, updatedAt: Date.now() }));
}

function clearConversation(serviceId) {
  localStorage.removeItem(accountKey(`conversation-${serviceId}`));
  localStorage.removeItem(accountKey(`history-${serviceId}`));
}

function getChatHistory(serviceId) {
  const key = accountKey(`history-${serviceId}`);
  try {
    const cutoff = Date.now() - HISTORY_TTL;
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    const history = Array.isArray(value) ? value.filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string" && Number(item.createdAt) >= cutoff) : [];
    if (history.length !== (Array.isArray(value) ? value.length : 0)) localStorage.setItem(key, JSON.stringify(history));
    return history;
  } catch { return []; }
}

function appendChatHistory(serviceId, role, content) {
  const key = accountKey(`history-${serviceId}`);
  const createdAt = Date.now();
  const history = [...getChatHistory(serviceId), { role, content: String(content).slice(0, 12000), createdAt }].slice(-80);
  try { localStorage.setItem(key, JSON.stringify(history)); }
  catch { try { localStorage.setItem(key, JSON.stringify(history.slice(-30))); } catch { /* 浏览器存储不可用时不影响聊天 */ } }
  if (role === "user" && ["study", "personal"].includes(serviceId)) appendLearningEvent(serviceId, content, createdAt);
}

function appendLearningEvent(serviceId, content, createdAt) {
  const key = accountKey("learning-path");
  const events = getLearningEvents();
  const topic = inferTopic(content);
  const last = events.at(-1);
  if (!last || last.topic !== topic || createdAt - last.createdAt > 20 * 60 * 1000) events.push({ serviceId, topic, createdAt });
  localStorage.setItem(key, JSON.stringify(events.slice(-24)));
}

function getLearningEvents() {
  const key = accountKey("learning-path");
  try {
    const cutoff = Date.now() - HISTORY_TTL;
    const events = JSON.parse(localStorage.getItem(key) || "[]");
    const recent = Array.isArray(events) ? events.filter((event) => event && typeof event.topic === "string" && Number(event.createdAt) >= cutoff) : [];
    if (recent.length !== (Array.isArray(events) ? events.length : 0)) localStorage.setItem(key, JSON.stringify(recent));
    return recent;
  } catch { return []; }
}

function inferTopic(question) {
  const rules = [[/python|代码|编程/i, "Python 与编程"], [/统计|相关|因果|概率|回归/i, "统计推断"], [/清洗|缺失|异常|预处理/i, "数据清洗"], [/可视化|图表|绘图/i, "数据可视化"], [/模型|分类|聚类|预测|机器学习/i, "机器学习"], [/探索|eda|分析/i, "探索性数据分析"]];
  return rules.find(([pattern]) => pattern.test(question))?.[1] || "数据科学基础";
}

function formatText(value) { return escapeHtml(String(value)).replaceAll("\n", "<br>"); }

function escapeHtml(value) { const element = document.createElement("div"); element.textContent = value; return element.innerHTML; }
landing();
