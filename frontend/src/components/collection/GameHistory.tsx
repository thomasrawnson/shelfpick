import { useEffect, useId, useRef, useState } from "react";

import {
  deletePlay,
  historyCacheName,
  type Game,
  type GamePlay,
  type GameHistory as GameHistoryData,
} from "../../api/client";

import { createBGStatsHistoryUrl } from "../../utils/bgstats";
import { minutesOrDash, playsLabel, winnersFirst } from "../../game-detail-format";
import { outcomeLabel } from "../../play-results";
import { usePlaySync } from "../../offline/play-sync-context";
import { historyWithQueued } from "../../offline/queued-plays";
import PendingPlayControls from "../offline/PendingPlayControls";
import SavedCopyNotice from "../offline/SavedCopyNotice";

import ConfirmSheet from "../ui/ConfirmSheet";
import LoadingMessage from "../ui/LoadingMessage";
import OverflowMenu from "../ui/OverflowMenu";
import PlayLogForm from "./PlayLogForm";
import PlayShareDialog from "./PlayShareDialog";

type Props = {
  game: Game;
  history: GameHistoryData | null;
  loading: boolean;
  onPlayDeleted: () => Promise<void>;
  onPlayEdited: () => Promise<void>;
  onRematch: (play: GamePlay) => void;
};

const OUTCOME_TYPE_LABELS = {
  competitive: null,
  cooperative: "Co-op",
  team: "Teams",
  solo: "Solo",
} as const;

function formatDate(playedAt: string) {
  return new Date(playedAt).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function CheckMark() {
  return (
    <svg className="won-check" viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" focusable="false">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

type EntryProps = {
  game: Game;
  play: GamePlay;
  deleteError: string;
  shareRef: (element: HTMLButtonElement | null) => void;
  onShare: () => void;
  onEdit: () => void;
  onRematch: () => void;
  onDelete: () => void;
};

// One recent play: the date and facts with a collapse chevron, the players (winners first) and the actions. Rematch is the
// main action, Share and Edit are quiet, and Delete play sits in the "…" menu and always asks first.
function PlayEntry({ game, play, deleteError, shareRef, onShare, onEdit, onRematch, onDelete }: EntryProps) {
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  const date = formatDate(play.played_at);
  const facts = [
    `${play.player_count} ${play.player_count === 1 ? "player" : "players"}`,
    play.duration_minutes ? `${play.duration_minutes} min` : null,
  ].filter(Boolean).join(" · ");
  const typeLabel = OUTCOME_TYPE_LABELS[play.outcome_type];
  const coopWon = play.outcome_type === "cooperative" && play.coop_result === "won";

  return (
    <div className="recent-play-detail">
      <div className="recent-play-header">
        <div className="recent-play-when">
          <strong>{date}</strong>
          <span>{facts}</span>
        </div>
        <button
          type="button"
          className="entry-toggle"
          aria-expanded={open}
          aria-controls={bodyId}
          aria-label={`${open ? "Collapse" : "Expand"} play on ${date}`}
          onClick={() => setOpen((current) => !current)}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="m6 9 6 6 6-6" /></svg>
        </button>
      </div>

      <div id={bodyId} hidden={!open}>
        {play.location && <p className="recent-play-location">At {play.location}</p>}

        <PendingPlayControls play={play} />

        {typeLabel && (
          <p className="recent-play-type">
            {typeLabel}
            {play.coop_result && (
              <>
                {" · "}
                <span className={coopWon ? "won" : undefined}>{coopWon && <CheckMark />}{coopWon ? "Won" : "Lost"}</span>
              </>
            )}
          </p>
        )}

        {play.participants.length > 0 && (
          <ul className="play-participants">
            {winnersFirst(play.participants).map((participant) => {
              const winner = participant.outcome === "win" || participant.outcome === "draw";
              const label = outcomeLabel(participant.outcome);
              return (
                <li className={winner ? "history-player winner" : "history-player"} key={participant.id}>
                  <span className="history-player-name">
                    {participant.name}
                    {participant.team && ` · ${participant.team}`}
                    {participant.rank != null && ` · #${participant.rank}`}
                    {!winner && label && ` · ${label}`}
                  </span>
                  {winner && <span className="won"><CheckMark />{label}</span>}
                  <strong>{participant.score ?? "—"}</strong>
                </li>
              );
            })}
          </ul>
        )}

        <div className="recent-play-actions">
          <button type="button" className="rematch-action" onClick={onRematch}>Rematch</button>
          {!play.pending && (
            <button type="button" ref={shareRef} className="text-action" onClick={onShare}>Share play</button>
          )}
          <button type="button" className="text-action" onClick={onEdit}>Edit</button>
          <OverflowMenu
            label={`More options for the ${date} play`}
            items={[
              ...(play.source !== "bgstats" && !play.pending
                ? [{ key: "bgstats", label: "Send to BG Stats", href: createBGStatsHistoryUrl(game, play) }]
                : []),
              { key: "delete", label: "Delete play", destructive: true, onSelect: onDelete },
            ]}
          />
        </div>

        {deleteError && <p className="error-message" role="alert">{deleteError}</p>}
      </div>
    </div>
  );
}

function GameHistory({
  game,
  history: serverHistory,
  loading,
  onPlayDeleted,
  onPlayEdited,
  onRematch,
}: Props) {
  const { items, discardQueued } = usePlaySync();
  // Plays logged on this device that have not synced yet appear with the ones the server knows.
  const history = historyWithQueued(serverHistory, items, game.bgg_id);
  const [editingPlayId, setEditingPlayId] = useState<number | null>(null);
  const editingPlay = history?.recent_plays.find((play) => play.id === editingPlayId) ?? null;
  const [confirmingPlayId, setConfirmingPlayId] = useState<number | null>(null);
  const confirmingPlay = history?.recent_plays.find((play) => play.id === confirmingPlayId) ?? null;

  const [deletingPlayId, setDeletingPlayId] = useState<number | null>(null);

  const [deleteErrorPlayId, setDeleteErrorPlayId] = useState<number | null>(
    null,
  );

  const [deleteError, setDeleteError] = useState("");
  const [sharingPlay, setSharingPlay] = useState<GamePlay | null>(null);
  const shareButtons = useRef(new Map<number, HTMLButtonElement>());
  const shareReturnPlayId = useRef<number | null>(null);

  useEffect(() => {
    if (sharingPlay !== null || shareReturnPlayId.current === null) return;
    const playId = shareReturnPlayId.current;
    shareReturnPlayId.current = null;
    window.requestAnimationFrame(() => shareButtons.current.get(playId)?.focus());
  }, [sharingPlay]);

  function openShare(play: GamePlay) {
    shareReturnPlayId.current = play.id;
    setSharingPlay(play);
  }

  function closeShare() {
    setSharingPlay(null);
  }

  function requestDeletePlay(playId: number) {
    setDeleteErrorPlayId(null);
    setDeleteError("");
    setConfirmingPlayId(playId);
  }

  function cancelDeletePlay() {
    setConfirmingPlayId(null);
  }

  async function confirmDeletePlay(playId: number) {
    setDeletingPlayId(playId);
    setDeleteErrorPlayId(null);
    setDeleteError("");

    try {
      const queued = history?.recent_plays.find((play) => play.id === playId);
      if (queued?.pending && queued.client_id) {
        // Not on the server yet: removing it from the queue is the whole delete.
        const removed = await discardQueued(queued.client_id);
        if (!removed.ok) throw new Error("This play just synced. Delete it again.");
      } else {
        await deletePlay(playId);
      }

      await onPlayDeleted();
    } catch (err) {
      console.error(err);

      setDeleteErrorPlayId(playId);
      setDeleteError("Couldn't delete this play.");
    } finally {
      setDeletingPlayId(null);
      setConfirmingPlayId(null);
    }
  }
  return (
    <div className="detail-block game-history">
      <h2 className="section-label">Your history</h2>
      <SavedCopyNotice names={[historyCacheName(game.bgg_id)]} what="history" />

      {loading ? (
        <p className="history-empty">
          <LoadingMessage
            messages={[
              "Pulling out the scorepad...",
              "Digging through the play log...",
              "Counting up past games...",
            ]}
          />
        </p>
      ) : history ? (
        <>
          <div className="detail-metrics">
            <div className="detail-metric">
              <strong>{history.play_count}</strong>
              <span>{playsLabel(history.play_count)}</span>
            </div>

            <div className="detail-metric">
              <strong>{history.average_players?.toFixed(1) ?? "—"}</strong>
              <span>Avg players</span>
            </div>

            <div className="detail-metric">
              <strong>{minutesOrDash(history.average_duration_minutes)}</strong>
              <span>Avg mins</span>
            </div>
          </div>

          {history.last_played_at && (
            <p className="history-last-played">
              Last played{" "}
              {new Date(history.last_played_at).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </p>
          )}

          {history.recent_plays.length > 0 ? (
            <div className="recent-plays">
              <h3 className="section-label">Recent plays</h3>

              {editingPlay && (
                <PlayLogForm
                  game={game}
                  editingPlay={editingPlay}
                  onClose={() => setEditingPlayId(null)}
                  onSaved={async () => {
                    await onPlayEdited();
                  }}
                />
              )}

              {history.recent_plays.map((play) => (
                <PlayEntry
                  key={play.id}
                  game={game}
                  play={play}
                  deleteError={deleteError && deleteErrorPlayId === play.id ? deleteError : ""}
                  shareRef={(element) => {
                    if (element) shareButtons.current.set(play.id, element);
                    else shareButtons.current.delete(play.id);
                  }}
                  onShare={() => openShare(play)}
                  onEdit={() => setEditingPlayId(play.id)}
                  onRematch={() => onRematch(play)}
                  onDelete={() => requestDeletePlay(play.id)}
                />
              ))}
            </div>
          ) : (
            <p className="history-empty">
              No plays logged yet — break the seal.
            </p>
          )}
        </>
      ) : (
        <p className="history-empty">Play history unavailable. It loads when you're back online.</p>
      )}
      {confirmingPlay && (
        <ConfirmSheet
          title="Delete this play?"
          confirmLabel="Delete play"
          busyLabel="Deleting…"
          busy={deletingPlayId === confirmingPlay.id}
          onConfirm={() => { void confirmDeletePlay(confirmingPlay.id); }}
          onCancel={cancelDeletePlay}
        >
          The {formatDate(confirmingPlay.played_at)} play of {game.name} will be removed from your history. This can’t be undone.
        </ConfirmSheet>
      )}
      {sharingPlay && (
        <PlayShareDialog game={game} play={sharingPlay} onClose={closeShare} />
      )}
    </div>
  );
}

export default GameHistory;
