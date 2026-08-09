import { z } from "zod";

export const TagInputSchema = z.object({
  name: z.string(),
  type: z.enum(["ROOT", "AFFIX", "MEANING", "GRAMMAR", "CUSTOM"]),
  description: z.string().optional(),
});

export const RelationshipInputSchema = z.object({
  word: z.string(),
  type: z.enum([
    "SYNONYM",
    "ANTONYM",
    "SAME_ROOT",
    "SAME_AFFIX",
    "SAME_GRAMMAR",
    "CUSTOM",
  ]),
  description: z.string().optional(),
});

export const AiWordAnalysisSchema = z.object({
  word: z.string(),
  meaning: z.string(),
  pronunciation: z.string().optional(),
  exampleSentence: z.string().optional(),
  tags: z.array(TagInputSchema).optional().default([]),
  relationships: z.array(RelationshipInputSchema).optional().default([]),
  sameMeaningWords: z.array(z.string()).optional().default([]),
});

export const AiProcessBatchSchema = z.object({
  words: z.array(AiWordAnalysisSchema),
});
