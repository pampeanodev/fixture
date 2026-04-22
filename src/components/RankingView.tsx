import { useMemo, useState } from "react";
import { useFixture } from "../context/FixtureContext";
import { computeRanking } from "../utils/scoring";
import { useLocale } from "../i18n";
import type { RankedPlayer } from "../utils/scoring";
import "./RankingView.css";

export function RankingView() {
  const { state, dispatch } = useFixture();
  const { t } = useLocale();

  const ranking = useMemo(() => {
    const base = computeRanking(state, t("common.youFallback"));
    const totalMatches = state.groupMatches.length + state.knockoutMatches.length;
    const existingNames = new Set(base.map((p) => p.name));
    const extras: RankedPlayer[] = state.members
      .filter((m) => !existingNames.has(m.name))
      .map((m) => ({
        name: m.name,
        isLocal: false,
        total: 0,
        exact: 0,
        winner: 0,
        wrong: 0,
        pending: totalMatches,
      }));
    return [...base, ...extras];
  }, [state, t]);

  const hasPlayers = ranking.length > 1;
  const [showRules, setShowRules] = useState(false);

  return (
    <div className="ranking-view">
      <div className="ranking-header">
        <h2>{t("ranking.title")}</h2>
        <button className="ranking-rules-btn" onClick={() => setShowRules((v) => !v)}>
          {showRules ? t("ranking.rulesClose") : t("ranking.rulesOpen")}
        </button>
      </div>

      {showRules && (
        <div className="ranking-rules">
          <h3>{t("ranking.rulesSectionScoring")}</h3>
          <div className="ranking-rules-grid">
            <div className="ranking-rule-card exact">
              <div className="ranking-rule-points">{t("ranking.rule.exactPoints")}</div>
              <div className="ranking-rule-icon">{t("ranking.rule.exactSymbol")}</div>
              <div className="ranking-rule-label">{t("ranking.rule.exactLabel")}</div>
              <div className="ranking-rule-example">{t("ranking.rule.exactExample")}</div>
            </div>
            <div className="ranking-rule-card winner">
              <div className="ranking-rule-points">{t("ranking.rule.winnerPoints")}</div>
              <div className="ranking-rule-icon">{t("ranking.rule.winnerSymbol")}</div>
              <div className="ranking-rule-label">{t("ranking.rule.winnerLabel")}</div>
              <div className="ranking-rule-example">{t("ranking.rule.winnerExample")}</div>
            </div>
            <div className="ranking-rule-card wrong">
              <div className="ranking-rule-points">{t("ranking.rule.wrongPoints")}</div>
              <div className="ranking-rule-icon">{t("ranking.rule.wrongSymbol")}</div>
              <div className="ranking-rule-label">{t("ranking.rule.wrongLabel")}</div>
              <div className="ranking-rule-example">{t("ranking.rule.wrongExample")}</div>
            </div>
          </div>

          <h3>{t("ranking.rulesSectionTiebreak")}</h3>
          <p>{t("ranking.tiebreakIntro")}</p>
          <ol>
            <li>{t("ranking.tiebreak1")}</li>
            <li>{t("ranking.tiebreak2")}</li>
          </ol>

          <h3>{t("ranking.rulesSectionHowTo")}</h3>
          <ol>
            <li>{t("ranking.howTo1")}</li>
            <li>{t("ranking.howTo2")}</li>
            <li>{t("ranking.howTo3")}</li>
            <li>{t("ranking.howTo4")}</li>
            <li>{t("ranking.howTo5")}</li>
          </ol>
        </div>
      )}

      {!hasPlayers ? (
        <div className="ranking-empty">
          <p>{t("ranking.emptyTitle")}</p>
          <p><strong>{t("ranking.emptyStep1Prefix")}</strong> {t("ranking.emptyStep1")}</p>
          <p><strong>{t("ranking.emptyStep2Prefix")}</strong> {t("ranking.emptyStep2")}</p>
          <p><strong>{t("ranking.emptyStep3Prefix")}</strong> {t("ranking.emptyStep3")}</p>
          <p><strong>{t("ranking.emptyStep4Prefix")}</strong> {t("ranking.emptyStep4")}</p>
        </div>
      ) : (
        <table className="ranking-table">
          <thead>
            <tr>
              <th>{t("ranking.colRank")}</th>
              <th>{t("ranking.colPlayer")}</th>
              <th>{t("ranking.colPoints")}</th>
              <th>{t("ranking.colExact")}</th>
              <th>{t("ranking.colWinner")}</th>
              <th>{t("ranking.colWrong")}</th>
              <th>{t("ranking.colPending")}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {ranking.map((player, i) => (
              <tr key={player.name} className={player.isLocal ? "local" : ""}>
                <td>{i + 1}</td>
                <td>
                  {player.name}
                  {player.isLocal && <span className="ranking-name-you">{t("ranking.youSuffix")}</span>}
                </td>
                <td className="ranking-total">{player.total}</td>
                <td>{player.exact}</td>
                <td>{player.winner}</td>
                <td>{player.wrong}</td>
                <td>{player.pending}</td>
                <td>
                  {!player.isLocal && (
                    <button
                      className="ranking-remove"
                      onClick={() => dispatch({ type: "REMOVE_RIVAL", name: player.name })}
                      title={t("ranking.removeRivalTitle", { name: player.name })}
                    >×</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
