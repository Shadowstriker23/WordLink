import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { reviewToCard } from "@/lib/fsrs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const days = Math.min(Number(searchParams.get("days") ?? 30), 90);

  const [reviews, reviewLogs, totalWords, tagCount] = await Promise.all([
    prisma.review.findMany(),
    prisma.reviewLog.findMany({
      orderBy: { reviewDate: "asc" },
      select: { reviewDate: true, rating: true },
    }),
    prisma.word.count(),
    prisma.tag.count(),
  ]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const forecast: { date: string; count: number }[] = [];
  for (let i = 0; i < days; i++) {
    forecast.push({
      date: new Date(today.getTime() + i * 86400000)
        .toISOString()
        .slice(0, 10),
      count: 0,
    });
  }

  const dateToIndex = new Map(forecast.map((f, i) => [f.date, i]));
  for (const review of reviews) {
    if (review.state === 0) {
      forecast[0].count += 1;
      continue;
    }
    const card = reviewToCard(review);
    if (card.due.getTime() > today.getTime() + days * 86400000) continue;
    const key = new Date(card.due).toISOString().slice(0, 10);
    const idx = dateToIndex.get(key);
    if (idx !== undefined) forecast[idx].count += 1;
  }

  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today.getTime() - (6 - i) * 86400000);
    return d.toISOString().slice(0, 10);
  });
  const logCountByDay = new Map<string, number>();
  for (const log of reviewLogs) {
    const key = new Date(log.reviewDate).toISOString().slice(0, 10);
    logCountByDay.set(key, (logCountByDay.get(key) ?? 0) + 1);
  }
  const reviewActivity = last7Days.map((date) => ({
    date,
    count: logCountByDay.get(date) ?? 0,
  }));

  const ratingBreakdown = [1, 2, 3, 4].map((rating) => ({
    rating,
    count: reviewLogs.filter((l) => l.rating === rating).length,
  }));

  return NextResponse.json({
    overview: { totalWords, tagCount, totalReviews: reviewLogs.length },
    forecast,
    reviewActivity,
    ratingBreakdown,
  });
}
