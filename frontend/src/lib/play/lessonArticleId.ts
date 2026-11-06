import {
  TECHNIQUE_ARTICLE_ORDER,
  techniqueArticle,
  type TechniqueArticleId,
} from "@/content/techniquesGuideCopy";

export function lessonArticleId(technique: string | null): TechniqueArticleId {
  if (technique === null) {
    throw new Error("lesson game missing lesson_technique");
  }
  if (!(TECHNIQUE_ARTICLE_ORDER as readonly string[]).includes(technique)) {
    throw new Error(`unknown lesson technique: ${technique}`);
  }
  return technique as TechniqueArticleId;
}

export function lessonHudTitle(technique: string | null): string {
  return techniqueArticle("en", lessonArticleId(technique)).name;
}
