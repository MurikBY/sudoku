import type { ReactNode } from "react";

import { TECHNIQUE_EN_NAMES, type TechniqueArticleId } from "@/content/techniquesGuideCopy";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const NAME_BY_ID = new Map(TECHNIQUE_EN_NAMES.map((item) => [item.name, item.id]));
const NAME_SPLITTER = new RegExp(
  `(${[...TECHNIQUE_EN_NAMES]
    .sort((left, right) => right.name.length - left.name.length)
    .map((item) => escapeRegExp(item.name))
    .join("|")})`,
  "g",
);

export function renderTechniqueNameLinks(
  text: string,
  currentArticleId: TechniqueArticleId,
  onOpenLinkedArticle: (articleId: TechniqueArticleId) => void,
): ReactNode {
  return text.split(NAME_SPLITTER).map((part, index) => {
    const articleId = NAME_BY_ID.get(part);
    if (articleId === undefined || articleId === currentArticleId) {
      return part;
    }
    return (
      <button
        key={`${articleId}-${index}`}
        type="button"
        className="gazette-guide-technique-name-link"
        onClick={() => onOpenLinkedArticle(articleId)}
      >
        {part}
      </button>
    );
  });
}
