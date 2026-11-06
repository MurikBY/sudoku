import type { ReactNode } from "react";

export function renderGuideMarkedText(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const chunks = text.split(/(\n\n)/);

  chunks.forEach((chunk, chunkIndex) => {
    if (chunk === "\n\n") {
      nodes.push(<br key={`break-a-${chunkIndex}`} />);
      nodes.push(<br key={`break-b-${chunkIndex}`} />);
      return;
    }

    chunk.split(/(\*[^*]+\*)/g).forEach((part, partIndex) => {
      if (part.length >= 2 && part.startsWith("*") && part.endsWith("*")) {
        nodes.push(<em key={`${chunkIndex}-${partIndex}`}>{part.slice(1, -1)}</em>);
        return;
      }
      if (part.length > 0) {
        nodes.push(<span key={`${chunkIndex}-${partIndex}`}>{part}</span>);
      }
    });
  });

  return nodes;
}
