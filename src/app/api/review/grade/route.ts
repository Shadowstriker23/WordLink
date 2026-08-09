import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  getOrCreateReview,
  reviewToCard,
  scheduleReview,
} from "@/lib/fsrs";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { wordId, rating, durationMs } = body;

  if (!wordId || ![1, 2, 3, 4].includes(rating)) {
    return NextResponse.json({ error: "参数错误" }, { status: 400 });
  }

  const review = await getOrCreateReview(wordId);
  const card = reviewToCard(review);
  const now = new Date();
  const result = scheduleReview(card, rating, now);

  const updated = await prisma.review.update({
    where: { wordId },
    data: {
      stability: result.card.stability,
      difficulty: result.card.difficulty,
      elapsedDays: result.card.elapsed_days,
      scheduledDays: result.card.scheduled_days,
      reps: result.card.reps,
      lapses: result.card.lapses,
      state: result.card.state,
      learningSteps: result.card.learning_steps,
      lastReview: now,
      due: result.card.due,
    },
  });

  await prisma.reviewLog.create({
    data: {
      wordId,
      rating,
      state: result.log.state,
      elapsedDays: result.log.elapsed_days,
      scheduledDays: result.log.scheduled_days,
      stability: result.log.stability,
      difficulty: result.log.difficulty,
      durationMs: durationMs ?? null,
    },
  });

  return NextResponse.json({
    nextDue: updated.due,
    scheduledDays: updated.scheduledDays,
    state: updated.state,
  });
}
