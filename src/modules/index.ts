import { registerModule } from "@/lib/registry";

registerModule({
  id: "dashboard",
  label: "仪表盘",
  routes: ["/"],
  nav: [{ href: "/", label: "仪表盘", icon: "LayoutDashboard", priority: 0 }],
});

registerModule({
  id: "explore",
  label: "标签检索",
  description: "多标签检索、词性检索与单词卡片",
  routes: ["/explore", "/tags/[name]"],
  nav: [
    {
      href: "/explore",
      label: "标签检索",
      icon: "SearchCheck",
      priority: 0,
    },
  ],
});

registerModule({
  id: "import",
  label: "导入",
  description: "拍照 OCR 或手动录入，AI 自动打标签",
  routes: ["/import"],
  nav: [{ href: "/import", label: "导入单词", icon: "Upload", priority: 1 }],
});

registerModule({
  id: "words",
  label: "单词库",
  description: "多维检索与单词管理",
  routes: ["/words", "/words/[id]"],
  nav: [{ href: "/words", label: "单词库", icon: "Library", priority: 2 }],
});

registerModule({
  id: "review",
  label: "复习",
  description: "FSRS 间隔复习",
  routes: ["/review"],
  nav: [{ href: "/review", label: "每日复习", icon: "Repeat", priority: 4 }],
});

registerModule({
  id: "stats",
  label: "统计",
  description: "遗忘曲线与学习数据",
  routes: ["/stats"],
  nav: [{ href: "/stats", label: "统计", icon: "BarChart3", priority: 5 }],
});

registerModule({
  id: "settings",
  label: "设置",
  description: "AI 服务配置",
  routes: ["/settings"],
  nav: [{ href: "/settings", label: "设置", icon: "Settings", priority: 99 }],
});
