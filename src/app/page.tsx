import Link from "next/link";
import { prisma } from "@/lib/db";
import { getNavItems } from "@/lib/registry";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

async function getStats() {
  const [totalWords, totalTags, dueCount, newCount, reviewLogs, reviews] =
    await Promise.all([
      prisma.word.count(),
      prisma.tag.count(),
      prisma.review.count({ where: { due: { lte: new Date() } } }),
      prisma.review.count({ where: { state: 0 } }),
      prisma.reviewLog.count(),
      prisma.review.count(),
    ]);
  return { totalWords, totalTags, dueCount, newCount, reviewLogs, reviews };
}

export default async function DashboardPage() {
  const stats = await getStats();
  const navItems = getNavItems().filter((n) => n.href !== "/");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">仪表盘</h1>
        <p className="text-sm text-muted">今天该复习多少？哪些单词即将遗忘？</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>词库总量</CardTitle>
            <CardDescription>已收录的单词 / 短语</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">{stats.totalWords}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>今日待复习</CardTitle>
            <CardDescription>FSRS 排程到期</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-warning">{stats.dueCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>待首次学习</CardTitle>
            <CardDescription>尚未评分的新单词</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-accent">{stats.newCount}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>累计复习</CardTitle>
            <CardDescription>历史复习次数</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">{stats.reviewLogs}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>快捷入口</CardTitle>
          <CardDescription>选择一个功能开始</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}>
              <Button variant="secondary">{item.label}</Button>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
