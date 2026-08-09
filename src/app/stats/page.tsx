"use client";

import { useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface Stats {
  overview: { totalWords: number; tagCount: number; totalReviews: number };
  forecast: { date: string; count: number }[];
  reviewActivity: { date: string; count: number }[];
  ratingBreakdown: { rating: number; count: number }[];
}

const RATING_LABEL: Record<number, string> = {
  1: "忘记",
  2: "困难",
  3: "记得",
  4: "简单",
};

const RATING_COLOR: Record<number, string> = {
  1: "#ef4444",
  2: "#f59e0b",
  3: "#0ea5e9",
  4: "#22c55e",
};

const DAY_LABEL = ["日", "一", "二", "三", "四", "五", "六"];

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.json())
      .then(setStats);
  }, []);

  if (!stats) {
    return (
      <div className="flex items-center justify-center py-32 text-muted">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const forecastData = stats.forecast.map((f) => ({
    ...f,
    label: new Date(f.date).toLocaleDateString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
    }),
  }));

  const activityData = stats.reviewActivity.map((a) => ({
    ...a,
    label: DAY_LABEL[new Date(a.date).getDay()],
  }));

  const ratingData = stats.ratingBreakdown.map((r) => ({
    ...r,
    name: RATING_LABEL[r.rating],
    count: r.count,
    color: RATING_COLOR[r.rating],
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">统计</h1>
        <p className="text-sm text-muted">遗忘曲线与学习数据</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>词库总量</CardTitle>
            <CardDescription>已收录单词</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-primary">
              {stats.overview.totalWords}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>标签数</CardTitle>
            <CardDescription>词根/词缀/意思/语法</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-accent">
              {stats.overview.tagCount}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>累计复习</CardTitle>
            <CardDescription>历史复习总次数</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-success">
              {stats.overview.totalReviews}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>遗忘曲线预测</CardTitle>
          <CardDescription>
            未来 30 天每天将遗忘（待复习）的单词数量，提前预习应对
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={forecastData}>
              <defs>
                <linearGradient id="forget" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <Tooltip
                labelFormatter={(label) => `日期: ${label}`}
                formatter={(value) => [`${value} 个`, "待复习"]}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#forget)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>近 7 天复习量</CardTitle>
            <CardDescription>按星期分布</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={activityData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip formatter={(v) => [`${v} 次`, "复习"]} />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>复习质量</CardTitle>
            <CardDescription>各评分占比</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={ratingData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <Tooltip formatter={(v) => [`${v} 次`, "次数"]} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {ratingData.map((entry) => (
                    <Cell key={entry.rating} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
