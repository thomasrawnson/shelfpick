import RetryNotice from "../ui/RetryNotice";
import {
  useEffect,
  useRef,
  useState,
} from "react";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";

import {
  getPickerMatches,
  getPickerOptions,
  recordPickerEvent,
  type PickerMatch,
  type PickerComplexityBand,
  type PickerMode,
  type PickerNoMatchGuidance,
  type PickerPlayStyle,
} from "../../api/client";

import { PlayerStep } from "./PlayerStep";
import PlayerSelectionStep from "./PlayerSelectionStep";
import TimeStep from "./TimeStep";
import ThemeStep from "./ThemeStep";
import PlayStyleStep from "./PlayStyleStep";
import PickerResult from "./PickerResult";
import PickerNoMatch from "./PickerNoMatch";
import PickerPlayEntry from "./PickerPlayEntry";
import { timeBand, trackEvent } from "../../telemetry";
import { APP_PATHS } from "../../routes";

type Step =
  | "players"
  | "player_selection"
  | "time"
  | "theme"
  | "play_style"
  | "no_match"
  | "reveal";

type Props = {
  onViewGame: (bggId: number) => void;
  onViewCollection: () => void;
  defaultPlayers?: number | null;
  defaultTime?: number | null;
  defaultPlayStyle?: PickerPlayStyle | null;
};

function savedPlayStyleOrFallback(value: PickerPlayStyle | null | undefined): PickerPlayStyle {
  return value === "cooperative" || value === "competitive" ? value : "any";
}

function PickerView({
  onViewGame,
  onViewCollection,
  defaultPlayers = null,
  defaultTime = null,
  defaultPlayStyle = null,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("players");
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [selectedPlayerNames, setSelectedPlayerNames] = useState<string[]>([]);
  const [players, setPlayers] = useState<number | null>(defaultPlayers);
  const [maxPlayTime, setMaxPlayTime] = useState<number | null>(defaultTime);
  const [complexityBand, setComplexityBand] =
    useState<PickerComplexityBand | null>(null);
  const [youngestPlayerAge, setYoungestPlayerAge] =
    useState<number | null>(null);
  const [playStyle, setPlayStyle] = useState<PickerPlayStyle>(() =>
    savedPlayStyleOrFallback(defaultPlayStyle),
  );
  const [preferredCategories, setPreferredCategories] = useState<string[]>([]);
  const [preferredMechanics, setPreferredMechanics] = useState<string[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>([]);
  const [mechanicOptions, setMechanicOptions] = useState<string[]>([]);
  const [mode, setMode] = useState<PickerMode>("best_match");
  const [matches, setMatches] = useState<PickerMatch[]>([]);
  const [matchIndex, setMatchIndex] = useState(0);
  const [noMatchGuidance, setNoMatchGuidance] =
    useState<PickerNoMatchGuidance | null>(null);
  const [pickerSessionId, setPickerSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [playSavedMessage, setPlaySavedMessage] = useState("");
  const pending = useRef(false);
  const [optionsError, setOptionsError] = useState("");
  const [optionsLoading, setOptionsLoading] = useState(true);
  const [optionsAttempt, setOptionsAttempt] = useState(0);
  const swipeStartX = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOptions() {
      try {
        const options = await getPickerOptions();
        if (cancelled) return;
        setOptionsError("");
        setCategoryOptions(options.categories);
        setMechanicOptions(options.mechanics);
      } catch (err) {
        if (!cancelled) setOptionsError(err instanceof Error ? err.message : "Couldn't load themes and play styles.");
      } finally {
        if (!cancelled) setOptionsLoading(false);
      }
    }

    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [optionsAttempt]);

  const match = matches[matchIndex];
  const hasMoreMatches = matchIndex < matches.length - 1;

  function toggleCategory(category: string) {
    setPreferredCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  }

  function toggleMechanic(mechanic: string) {
    setPreferredMechanics((current) =>
      current.includes(mechanic)
        ? current.filter((item) => item !== mechanic)
        : [...current, mechanic],
    );
  }

  function handlePlayerSelection(playerIds: number[], playerNames: string[]) {
    setSelectedPlayerIds(playerIds);
    setSelectedPlayerNames(playerNames);
    setPlayers(playerIds.length > 0 ? playerIds.length : null);
  }

  function chooseGroupSize(count: number | null) {
    setSelectedPlayerIds([]);
    setSelectedPlayerNames([]);
    setPlayers(count);
  }

  async function loadMatches(
    nextMaxPlayTime = maxPlayTime,
    nextComplexityBand = complexityBand,
    nextYoungestPlayerAge = youngestPlayerAge,
    nextPlayStyle = playStyle,
  ) {
    if (players === null || pending.current) return;

    pending.current = true;
    setLoading(true);
    setError("");

    try {
      const response = await getPickerMatches({
        players,
        playerIds: selectedPlayerIds,
        maxPlayTime:
          nextMaxPlayTime === 0
            ? undefined
            : (nextMaxPlayTime ?? undefined),
        complexityBand: nextComplexityBand ?? undefined,
        youngestPlayerAge: nextYoungestPlayerAge ?? undefined,
        playStyle: nextPlayStyle,
        preferredCategories,
        preferredMechanics,
        mode,
      });

      setPickerSessionId(response.session_id);

      trackEvent("picker_completed", {
        source: "pick", player_count: players,
        time_band: timeBand(nextMaxPlayTime), result_count: response.matches.length,
      });

      if (response.matches.length === 0) {
        setNoMatchGuidance(response.guidance);
        setStep("no_match");
        return;
      }

      setMatches(response.matches);
      setNoMatchGuidance(null);
      setMatchIndex(0);
      setStep("reveal");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Couldn't find a game. Please try again.");
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  function revealGame() {
    void loadMatches();
  }

  function relaxTime() {
    setMaxPlayTime(null);
    void loadMatches(null, complexityBand);
  }

  function relaxComplexity() {
    setComplexityBand(null);
    setYoungestPlayerAge(null);
    setPlayStyle(savedPlayStyleOrFallback(defaultPlayStyle));
    void loadMatches(maxPlayTime, null, null, "any");
  }

  function relaxTimeAndComplexity() {
    setMaxPlayTime(null);
    setComplexityBand(null);
    setYoungestPlayerAge(null);
    setPlayStyle("any");
    void loadMatches(null, null, null, "any");
  }

  function tryAnother() {
    if (!hasMoreMatches) return;

    const nextIndex = matchIndex + 1;
    const nextMatch = matches[nextIndex];

    void recordPickerEvent(
      pickerSessionId,
      "try_another",
      nextMatch.game.bgg_id,
      nextIndex,
    );

    setMatchIndex(nextIndex);
  }

  function startOver() {
    void recordPickerEvent(
      pickerSessionId,
      "start_over",
      match?.game.bgg_id,
      match ? matchIndex : undefined,
    );

    setStep("players");
    setPlayers(defaultPlayers);
    setSelectedPlayerIds([]);
    setSelectedPlayerNames([]);
    setMaxPlayTime(defaultTime);
    setComplexityBand(null);
    setYoungestPlayerAge(null);
    setPlayStyle("any");
    setPreferredCategories([]);
    setPreferredMechanics([]);
    setMode("best_match");
    setMatches([]);
    setMatchIndex(0);
    setError("");
    setNoMatchGuidance(null);
    setPickerSessionId(null);
    setPlaySavedMessage("");
  }

  function clearFineTune() {
    setYoungestPlayerAge(null);
    setPlayStyle("any");
    setPreferredCategories([]);
    setPreferredMechanics([]);
    setMode("best_match");
  }

  function viewGame() {
    if (!match) return;

    void recordPickerEvent(
      pickerSessionId,
      "view_game",
      match.game.bgg_id,
      matchIndex,
    );

    onViewGame(match.game.bgg_id);
  }

  const progressStep = step === "time" ? 1 : 0;
  const isPlayEntry = location.pathname === APP_PATHS.pickerPlay;

  if (isPlayEntry) {
    if (!match || step !== "reveal" || players === null) {
      return (
        <section className="screen picker-play-entry-missing">
          <h1>Choose a game first</h1>
          <p>
            This play-entry link needs an active Picker result.
            Your next pick will open here ready to log.
          </p>
          <button
            type="button"
            className="primary-button"
            onClick={() => navigate(APP_PATHS.picker, { replace: true })}
          >
            Go to Picker
          </button>
        </section>
      );
    }

    return (
      <PickerPlayEntry
        match={match}
        playerCount={players}
        playerNames={selectedPlayerNames}
        pickerSessionId={pickerSessionId}
        onCancel={() => navigate(-1)}
        onSaved={async () => {
          setPlaySavedMessage(`Play saved for ${match.game.name}.`);
          navigate(-1);
        }}
      />
    );
  }

  return (
    <>
      {optionsError && <RetryNotice message={optionsError} busy={optionsLoading} onRetry={() => { setOptionsLoading(true); setOptionsAttempt(current => current + 1); }} />}
      {error && <RetryNotice message={error} busy={loading} onRetry={revealGame} />}
      <fieldset className="picker-request-fields" disabled={loading} aria-busy={loading}>
      {step !== "reveal" && step !== "no_match" && (
        <div
          className="progress-dots"
          aria-label={`Picker step ${progressStep + 1} of 2`}
        >
          {[0, 1].map((index) => (
            <span
              key={index}
              className={progressStep === index ? "dot active" : "dot"}
            />
          ))}
        </div>
      )}

      {step === "players" && (
        <PlayerStep
          players={players}
          selectedPlayerIds={selectedPlayerIds}
          selectedPlayerNames={selectedPlayerNames}
          complexityBand={complexityBand}
          preferredCategories={preferredCategories}
          preferredMechanics={preferredMechanics}
          youngestPlayerAge={youngestPlayerAge}
          playStyle={playStyle}
          mode={mode}
          onSelectCount={chooseGroupSize}
          onComplexityChange={setComplexityBand}
          onYoungestPlayerAgeChange={setYoungestPlayerAge}
          onPlayStyleChange={setPlayStyle}
          onModeChange={setMode}
          onChoosePlayers={() => setStep("player_selection")}
          onOpenTheme={() => setStep("theme")}
          onOpenMechanics={() => setStep("play_style")}
          onClearFineTune={clearFineTune}
          onContinue={() => setStep("time")}
        />
      )}

      {step === "player_selection" && (
        <PlayerSelectionStep
          selectedPlayerIds={selectedPlayerIds}
          onChange={handlePlayerSelection}
          onBack={() => setStep("players")}
        />
      )}

      {step === "time" && (
        <TimeStep
          maxPlayTime={maxPlayTime}
          loading={loading}
          error=""
          onSelect={setMaxPlayTime}
          onFindGame={revealGame}
          onBack={() => setStep("players")}
        />
      )}

      {step === "theme" && (
        <ThemeStep
          options={categoryOptions}
          selected={preferredCategories}
          onToggle={toggleCategory}
          onClear={() => setPreferredCategories([])}
          onDone={() => setStep("players")}
          onBack={() => setStep("players")}
        />
      )}

      {step === "play_style" && (
        <PlayStyleStep
          options={mechanicOptions}
          selected={preferredMechanics}
          onToggle={toggleMechanic}
          onClear={() => setPreferredMechanics([])}
          onDone={() => setStep("players")}
          onBack={() => setStep("players")}
        />
      )}

      {step === "no_match" && players !== null && (
        <PickerNoMatch
          playerCount={players}
          guidance={noMatchGuidance}
          hasTimeLimit={maxPlayTime !== null && maxPlayTime !== 0}
          hasComplexityLimit={complexityBand !== null}
          loading={loading}
          error=""
          onRelaxTime={relaxTime}
          onRelaxComplexity={relaxComplexity}
          onRelaxBoth={relaxTimeAndComplexity}
          onAdjustChoices={() => setStep("players")}
          onStartOver={startOver}
          onViewCollection={onViewCollection}
        />
      )}

      {step === "reveal" && match && (
        <div
          className="picker-result-stage"
          onTouchStart={(event) => {
            swipeStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            if (swipeStartX.current === null) return;

            const endX =
              event.changedTouches[0]?.clientX ?? swipeStartX.current;
            const distance = endX - swipeStartX.current;
            swipeStartX.current = null;

            if (distance < -60 && hasMoreMatches) {
              tryAnother();
            }
          }}
        >
          <PickerResult
            match={match}
            matchIndex={matchIndex}
            totalMatches={matches.length}
            mode={mode}
            playerCount={players ?? 1}
            hasMoreMatches={hasMoreMatches}
            onTryAnother={tryAnother}
            onViewGame={viewGame}
            onStartOver={startOver}
            onLogPlay={() => {
              setPlaySavedMessage("");
              navigate(APP_PATHS.pickerPlay);
            }}
            playSavedMessage={playSavedMessage}
          />
        </div>
      )}
      </fieldset>
    </>
  );
}

export default PickerView;
