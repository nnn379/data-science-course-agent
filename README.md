# 数据科学导论课程智能体

这是一个不依赖构建工具的前端原型，包含学生端与教师端两套入口，以及五个独立的课程智能体服务界面。

## 本地预览

在项目目录运行 `python -m http.server 4173`，然后访问 `http://localhost:4173`。

## 接入 Dify Chatflow

网站保留自定义聊天界面，通过 Cloudflare Worker 调用五个 Dify Chatflow。Worker 的五个加密变量为：

- `DIFY_STUDY_KEY`：智能伴学中心
- `DIFY_PERSONAL_KEY`：个性化学习
- `DIFY_DESIGN_KEY`：教学设计辅助
- `DIFY_CASE_KEY`：课程案例生成
- `DIFY_GRADING_KEY`：作业批改辅助

部署 `worker/index.js` 后，把 Worker 的公开地址填入 `dify.config.js` 的 `apiUrl`。地址留空时，网站保留完整界面并使用内置演示回答。
