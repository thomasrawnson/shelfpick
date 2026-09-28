import { useEffect, useRef, useState } from "react";

import {
  deletePlay,
  type Game,
  type GamePlay,
  type GameHistory as GameHistoryData,
} from "../../api/client";

import { createBGStatsHistoryUrl } from "../../utils/bgstats";

import LoadingMessage from "../ui/LoadingMessage";
import PlayShareDialog from "./PlayShareDialog";

type Props = {
  game: Game;
  history: GameHistoryData | null;
  loading: boolean;
  onPlayDeleted: () => Promise<void>;
};

function GameHistory({ game, history, loading, onPlayDeleted }: Props) {
  const [confirmingPlayId, setConfirmingPlayId] = useState<number | null>(null);

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
      await deletePlay(playId);

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
    <div className="detail-section game-history">
      <p className="preference-label">Your history</p>

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
          <div className="history-stats">
            <div>
              <strong>{history.play_count}</strong>

              <span>Plays</span>
            </div>

            <div>
              <strong>{history.average_players?.toFixed(1) ?? "—"}</strong>

              <span>Avg players</span>
            </div>

            <div>
              <strong>{history.average_duration_minutes ?? "—"}</strong>

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
              <p className="preference-label">Recent plays</p>

              {history.recent_plays.map((play) => (
                <div className="recent-play-detail" key={play.id}>
                  <div className="recent-play-header">
                    <div>
                      <strong>
                        {new Date(play.played_at).toLocaleDateString(
                          undefined,
                          {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          },
                        )}
                      </strong>

                      <span>
                        {play.player_count}{" "}
                        {play.player_count === 1 ? "player" : "players"}
                      </span>
                    </div>

                    <span>
                      {play.duration_minutes
                        ? `${play.duration_minutes} min`
                        : "—"}
                    </span>
                  </div>

                  {play.location && (
                    <p className="recent-play-location">At {play.location}</p>
                  )}

                  {play.participants.length > 0 && (
                    <div className="play-participants">
                      {play.participants.map((participant) => (
                        <div
                          className={
                            participant.is_winner
                              ? "history-player winner"
                              : "history-player"
                          }
                          key={participant.id}
                        >
                          <span>
                            {participant.name}

                            {participant.is_winner && " · Winner"}
                          </span>

                          <strong>{participant.score ?? "—"}</strong>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="recent-play-actions">
                    <button
                      ref={(element) => {
                        if (element) shareButtons.current.set(play.id, element);
                        else shareButtons.current.delete(play.id);
                      }}
                      type="button"
                      className="secondary-button"
                      onClick={() => openShare(play)}
                    >
                      Share play
                    </button>
                    {play.source !== "bgstats" && (
                      <a
                        className="bgstats-history-link"
                        href={createBGStatsHistoryUrl(game, play)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Send to BG Stats
                      </a>
                    )}
                  </div>
                  {confirmingPlayId === play.id ? (
                    <div className="delete-play-confirm">
                      <span>Delete this play?</span>

                      <div className="delete-play-confirm-actions">
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={deletingPlayId === play.id}
                          onClick={cancelDeletePlay}
                        >
                          Cancel
                        </button>

                        <button
                          type="button"
                          className="delete-play-confirm-button"
                          disabled={deletingPlayId === play.id}
                          onClick={() => confirmDeletePlay(play.id)}
                        >
                          {deletingPlayId === play.id
                            ? "Deleting..."
                            : "Delete play"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      className="delete-play-button"
                      onClick={() => requestDeletePlay(play.id)}
                    >
                      Delete play
                    </button>
                  )}

                  {deleteError && deleteErrorPlayId === play.id && (
                    <p className="error-message">{deleteError}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="history-empty">
              No plays logged yet — break the seal.
            </p>
          )}
        </>
      ) : (
        <p className="history-empty">Play history unavailable.</p>
      )}
      {sharingPlay && (
        <PlayShareDialog game={game} play={sharingPlay} onClose={closeShare} />
      )}
    </div>
  );
}

export default GameHistory;
