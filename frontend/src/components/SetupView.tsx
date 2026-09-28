import {
  useState,
  useRef,
} from "react"

import {
  importBGStatsPlays,
  syncBGGCollection,
  type BGStatsImportResult,
  type CollectionSyncResult,
} from "../api/client"
import { trackEvent } from "../telemetry"


type Props = {
  initialUsername?: string | null
  onUsernameChange?: (
    username: string,
  ) => void
  compact?: boolean
}


function SetupView({
  initialUsername,
  onUsernameChange,
  compact = false,
}: Props) {
  const [username, setUsername] =
    useState(
      initialUsername ?? "",
    )

  const [syncing, setSyncing] =
    useState(false)

  const [syncResult, setSyncResult] =
    useState<CollectionSyncResult | null>(
      null,
    )

  const [syncError, setSyncError] =
    useState("")

  const [file, setFile] =
    useState<File | null>(null)

  const [importing, setImporting] =
    useState(false)

  const [importResult, setImportResult] =
    useState<BGStatsImportResult | null>(
      null,
    )

  const [importError, setImportError] =
    useState("")


  const syncPending = useRef(false)
  const importPending = useRef(false)
  async function handleSync() {
    const cleanedUsername =
      username.trim()

    if (!cleanedUsername || syncPending.current) {
      return
    }

    syncPending.current = true
    setSyncing(true)
    setSyncError("")


    try {
      const result =
        await syncBGGCollection(
          cleanedUsername,
        )

      setSyncResult(result)
      trackEvent("collection_import_completed", { source: "settings_bgg", result_count: result.games_synced })
      
      onUsernameChange?.(
        result.username,
      )
   } catch (err) {
      console.error(err)

      setSyncError(
        err instanceof Error
          ? err.message
          : "Couldn't sync that BGG collection.",
      )
    } finally {
      syncPending.current = false
      setSyncing(false)
    }
  }


  async function handleImport() {
    if (!file || importPending.current) {
      return
    }

    importPending.current = true
    setImporting(true)
    setImportError("")


    try {
      const result =
        await importBGStatsPlays(file)

      setImportResult(result)
      trackEvent("collection_import_completed", { source: "settings_bgstats", result_count: result.imported })
    } catch (err) {
      console.error(err)

      setImportError(
        err instanceof Error
          ? err.message
          : "Couldn't import that BG Stats export.",
      )
    }finally {
      importPending.current = false
      setImporting(false)
    }
  }


  return (
    <section className={compact ? "setup-screen setup-screen-compact" : "screen setup-screen"}>
      {!compact && <header>
        <p className="eyebrow">
          Your games
        </p>

        <h1>Set up your collection</h1>

        <p className="subtitle">
          Bring in your collection first,
          then add your play history.
        </p>
      </header>}


      <div className="setup-card">
        <div className="setup-step">
          <span>1</span>

          <div>
            <strong>
              Sync BoardGameGeek
            </strong>

            <p>
              Import the games you own
              from your BGG account.
            </p>
          </div>
        </div>


        <label
          className="setup-label"
          htmlFor="bgg-username"
        >
          BGG username
        </label>

        <input
          disabled={syncing}
          id="bgg-username"
          className="setup-input"
          type="text"
          value={username}
          placeholder="e.g. articsquirrel"
          autoCapitalize="none"
          autoCorrect="off"
          onChange={(event) =>
            setUsername(
              event.target.value,
            )
          }
        />


        <button
          className="primary-button setup-button"
          disabled={
            syncing ||
            username.trim().length === 0
          }
          onClick={handleSync}
        >
          {syncing
            ? "Syncing collection..."
            : syncError ? "Retry sync" : "Sync collection"}
        </button>


        {syncResult && (
          <div className="setup-success">
            <strong>
              {syncing || syncError || username.trim() !== syncResult.username ? "Previous successful sync" : "Collection synced"}
            </strong>

            <span>
              {syncResult.games_synced}{" "}
              games imported from BGG.
            </span>
          </div>
        )}


        {syncError && (
          <p className="error-message" role="alert">
            {syncError}
          </p>
        )}
      </div>


      <div className="setup-divider">
        <span>then</span>
      </div>


      <div className="setup-card">
        <div className="setup-step">
          <span>2</span>

          <div>
            <strong>
              Import BG Stats history
            </strong>

            <p>
              Upload your BG Stats JSON
              export to restore previous
              plays.
            </p>
          </div>
        </div>


        <label
          className="file-picker"
          htmlFor="bgstats-file"
        >
          <strong>
            {file
              ? file.name
              : "Choose BG Stats JSON"}
          </strong>

          <span>
            {file
              ? "Ready to import"
              : "Select your exported .json file"}
          </span>
        </label>

        <input
          disabled={importing}
          id="bgstats-file"
          className="file-input"
          type="file"
          accept=".json,application/json"
          onChange={(event) => {
            setFile(event.target.files?.[0] ?? null)
            setImportResult(null)
          }}
        />


        <button
          className="primary-button setup-button"
          disabled={
            importing ||
            file === null
          }
          onClick={handleImport}
        >
          {importing
            ? "Importing history..."
            : importError ? "Retry import" : "Import play history"}
        </button>


        {importResult && (
          <div className="setup-success">
            <strong>
              {importing || importError ? "Previous successful import" : "Play history imported"}
            </strong>

            <span>
              {importResult.imported}{" "}
              plays added
            </span>

            {importResult
              .skipped_existing > 0 && (
              <span>
                {
                  importResult
                    .skipped_existing
                }{" "}
                already existed
              </span>
            )}

            {importResult
              .skipped_missing_game >
              0 && (
              <span>
                {
                  importResult
                    .skipped_missing_game
                }{" "}
                skipped because the game
                isn't in your collection
              </span>
            )}
          </div>
        )}


        {importError && (
          <p className="error-message" role="alert">
            {importError}
          </p>
        )}
      </div>
    </section>
  )
}


export default SetupView
