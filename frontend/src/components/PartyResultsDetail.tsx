import type { PartyResults } from "@/api/types";
import { AssistsDetailGroups } from "@/components/AssistsDetailGroups";
import { assistsFromPayload } from "@/lib/play/preferencesSync";
import { partyPlayerStatLabel, partyPlayerTimeLabel } from "@/lib/play/partyResultsDisplay";

type PartyResultsDetailProps = {
  results: PartyResults;
  loading: boolean;
  reviewBusy: boolean;
  onReviewPlayer: (shareCode: string) => void;
};

export function PartyResultsDetail({
  results,
  loading,
  reviewBusy,
  onReviewPlayer,
}: PartyResultsDetailProps) {
  return (
    <div className="gazette-stats-ledger gazette-stats-party-detail">
      <div
        className={
          loading
            ? "gazette-stats-party-detail-body gazette-stats-ledger-refreshing"
            : "gazette-stats-party-detail-body"
        }
      >
        <p className="gazette-stats-pvp-difficulty">
          Difficulty: <span className="capitalize">{results.difficulty}</span>
        </p>
        <div className="gazette-stats-pvp-assists">
          <AssistsDetailGroups assists={assistsFromPayload(results.assists)} />
        </div>
        <div
          className="gazette-stats-ledger-rule gazette-stats-pvp-table-rule"
          aria-hidden="true"
        />
        <table className="stats-difficulty-table gazette-stats-pvp-table">
          <thead>
            <tr>
              <th scope="col" className="gazette-stats-pvp-player-col">
                Player
              </th>
              <th scope="col">Time</th>
              <th scope="col">Mistakes</th>
              <th scope="col">Hints</th>
              <th scope="col">Pencil</th>
            </tr>
          </thead>
          <tbody>
            {results.players.map((player) => {
              const canReview = Boolean(player.share_code);
              return (
                <tr key={player.user_id}>
                  <th scope="row" className="gazette-stats-pvp-player-col">
                    {canReview ? (
                      <button
                        type="button"
                        className="gazette-stats-pvp-player-link"
                        disabled={reviewBusy}
                        onClick={() => {
                          if (!player.share_code) {
                            throw new Error("party player missing share_code");
                          }
                          onReviewPlayer(player.share_code);
                        }}
                      >
                        {player.display_name}
                      </button>
                    ) : (
                      player.display_name
                    )}
                  </th>
                  <td>{partyPlayerTimeLabel(player)}</td>
                  <td>{partyPlayerStatLabel(player, "mistakes_count")}</td>
                  <td>{partyPlayerStatLabel(player, "hints_count")}</td>
                  <td>{partyPlayerStatLabel(player, "pencil_count")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="gazette-stats-pvp-review-hint">
          Tap a player name to open their Game Review.
        </p>
        <div className="gazette-stats-ledger-rule" aria-hidden="true" />
      </div>
    </div>
  );
}
