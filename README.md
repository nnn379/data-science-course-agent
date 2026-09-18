# 数据科学导论课程智能体

这是一个不依赖构建工具的前端原型，包含学生端与教师端两套入口，以及五个独立的课程智能体服务界面。

## 登录与学习记录

- 首页保留学生端与教师端两个入口；点击任一入口后，可分别注册或登录唯一用户名和密码，并可随时返回首页。
- 每个用户名独立保存各服务的对话，切换服务后返回仍可继续先前对话；登录后会恢复云端保存的记录，因此更换浏览器或设备也不会丢失。
- 对话、Dify conversation ID 和学生学习路径仅保留近 4 个月，超过期限会在下次读取时自动清除。
- 学生端侧边栏的“用户学习路径”会根据近四个月在智能伴学中心和个性化学习中的提问，自动归纳近期学习主题。

账户、会话和学习记录由 Cloudflare Worker 的 KV 存储保存；密码不会以明文保存在浏览器或 Worker 中。首次登录新版网站时，会自动迁移该浏览器中旧版的本地记录。

## 本地预览

在项目目录运行 `python -m http.server 4173`，然后访问 `http://localhost:4173`。

## 接入 Dify Chatflow

网站保留自定义聊天界面，通过 Cloudflare Worker 调用五个 Dify Chatflow。Worker 的五个加密变量为：

- `DIFY_STUDY_KEY`：智能伴学中心
- `DIFY_PERSONAL_KEY`：个性化学习
- `DIFY_DESIGN_KEY`：教学设计辅助
- `DIFY_CASE_KEY`：课程案例生成
- `DIFY_GRADING_KEY`：作业批改辅助

部署 `worker/index.js` 后，把 Worker 的公开地址填入 `dify.config.js` 的 `apiUrl`。Worker 还需要绑定 `COURSE_AGENT_DATA` Cloudflare KV 命名空间，用于保存账号和学习记录。地址留空时，网站保留完整界面并使用内置演示回答。
