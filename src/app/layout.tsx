import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AppShell } from "@/components/app-shell";
import { TagPanelProvider } from "@/lib/tag-panel-context";
import "@/modules";

export const metadata: Metadata = {
  title: "WordLink - 单词记忆知识库",
  description: "AI 驱动的英语单词关系图谱与间隔复习",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        <ThemeProvider />
        <TagPanelProvider>
          <AppShell>{children}</AppShell>
        </TagPanelProvider>
      </body>
    </html>
  );
}
