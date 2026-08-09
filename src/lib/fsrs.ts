import {
  createEmptyCard,
  fsrs,
  type Card,
  type FSRS,
  type FSRSParameters,
  type Grade,
  Rating,
} from "ts-fsrs";
import { prisma } from "./db";
import type { ReviewModel } from "@/generated/prisma/models";

export const RATING_AGAIN = 1;
export const RATING_HARD = 2;
export const RATING_GOOD = 3;
export const RATING_EASY = 4;

const params: Partial<FSRSParameters> = {
  request_retention: 0.9,
  maximum_interval: 36500,
  enable_fuzz: true,
  enable_short_term: true,
  learning_steps: ["1m", "10m"],
  relearning_steps: ["10m"],
};

const scheduler: FSRS = fsrs(params);

export function ratingToEnum(rating: number): Grade {
  switch (rating) {
    case RATING_AGAIN:
      return Rating.Again;
    case RATING_HARD:
      return Rating.Hard;
    case RATING_EASY:
      return Rating.Easy;
    default:
      return Rating.Good;
  }
}

export function reviewToCard(review: ReviewModel | null): Card {
  if (!review) return createEmptyCard(new Date());
  return {
    due: review.due,
    stability: review.stability,
    difficulty: review.difficulty,
    elapsed_days: review.elapsedDays,
    scheduled_days: review.scheduledDays,
    reps: review.reps,
    lapses: review.lapses,
    state: review.state as Card["state"],
    learning_steps: review.learningSteps,
    last_review: review.lastReview ?? undefined,
  };
}

export function scheduleReview(card: Card, rating: number, now = new Date()) {
  return scheduler.next(card, now, ratingToEnum(rating));
}

export function getRetrievability(card: Card, now = new Date()) {
  return scheduler.get_retrievability(card, now, false);
}

export async function getOrCreateReview(wordId: string): Promise<ReviewModel> {
  const existing = await prisma.review.findUnique({ where: { wordId } });
  if (existing) return existing;

  const card = createEmptyCard(new Date());
  return prisma.review.create({
    data: {
      wordId,
      stability: card.stability,
      difficulty: card.difficulty,
      reps: card.reps,
      lapses: card.lapses,
      state: card.state,
      due: card.due,
    },
  });
}
