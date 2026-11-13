import { AppearancePicker, AssistToggleList, AssistsFooter } from "@/components/AssistsSections";
import type { AssistKey, GameAssists } from "@/lib/play/gameSettings";

type AssistsPageProps = {
  assists: GameAssists;
  assistRows: { key: AssistKey; label: string }[];
  onAssistToggle: (key: AssistKey) => void;
  onOpenGuideAssists: () => void;
  onGoHome: () => void;
};

export function AssistsPage({
  assists,
  assistRows,
  onAssistToggle,
  onOpenGuideAssists,
  onGoHome,
}: AssistsPageProps) {
  return (
    <div className="gazette-home">
      <header className="gazette-home-masthead gazette-stats-masthead">
        <div className="gazette-guide-masthead-row">
          <h1 className="home-masthead gazette-guide-title">Settings</h1>
          <button type="button" onClick={onGoHome} className="gazette-guide-go-home">
            Go home
          </button>
        </div>
        <div className="gazette-home-masthead-rule" />
      </header>

      <div className="gazette-stats-ledger gazette-guide-ledger gazette-guide-ledger-toc gazette-assists-page">
        <section className="gazette-home-module gazette-home-module-settings">
          <AppearancePicker />
          <p className="gazette-assists-intro">
            These options change how the board helps you while you solve – turn each one on or off
            to match how you like to play.
          </p>
          <AssistToggleList
            assists={assists}
            assistRows={assistRows}
            onAssistToggle={onAssistToggle}
          />
          <AssistsFooter onOpenGuideAssists={onOpenGuideAssists} />
        </section>
      </div>
    </div>
  );
}
