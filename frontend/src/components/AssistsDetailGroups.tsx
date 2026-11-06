import type { GameAssists, AssistKey } from "@/lib/play/gameSettings";
import { ASSIST_ROWS } from "@/lib/play/gameSettings";

const ASSIST_DETAIL_GROUPS: {
  title: string;
  keys: AssistKey[];
}[] = [
  {
    title: "Board help",
    keys: [
      "highlightPeers",
      "highlightSameDigit",
      "mistakeFeedback",
      "dimCompletedDigits",
      "unitCompleteAnimation",
      "autoClearNotes",
      "stickyDigit",
    ],
  },
];

function assistLabel(key: AssistKey): string {
  const row = ASSIST_ROWS.find((item) => item.key === key);
  if (!row) {
    throw new Error(`unknown assist key: ${key}`);
  }
  return row.label;
}

export function AssistsDetailGroups({ assists }: { assists: GameAssists }) {
  return (
    <div className="assists-detail">
      {ASSIST_DETAIL_GROUPS.map((group) => (
        <div key={group.title} className="assists-detail-group">
          <p className="assists-detail-group-title">{group.title}</p>
          <ul className="assists-detail-list">
            {group.keys.map((key) => {
              const isOn = assists[key];
              return (
                <li key={key} className="assists-detail-row">
                  <span className="assists-detail-label">{assistLabel(key)}</span>
                  <span
                    className={
                      isOn ? "assists-detail-state assists-detail-state-on" : "assists-detail-state"
                    }
                  >
                    {isOn ? "On" : "Off"}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
