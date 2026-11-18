import { useId, useMemo, useState } from "react"

import {
  createScoresheet,
  deleteScoresheet,
  updateScoresheet,
  type Scoresheet,
} from "../../api/client"
import {
  LIMITS,
  draftFromSchema,
  emptyDraft,
  newCategory,
  schemaFromDraft,
  type BuilderDraft,
  type CategoryDraft,
} from "../../scoresheets/builder"
import {
  openRoundCount,
  scorePlay,
  type Breakdown,
  type CategoryType,
  type WinCondition,
} from "../../scoresheets/engine"
import ScoresheetGrid from "./ScoresheetGrid"

type Props = {
  gameName: string
  bggId: number
  // A custom sheet to edit; null builds a new one.
  editing: Scoresheet | null
  titleId: string
  onCancel: () => void
  onSaved: (sheet: Scoresheet) => void
  onDeleted: (id: number) => void
}

const WIN_CONDITIONS: { value: WinCondition; label: string }[] = [
  { value: "highest", label: "Highest total wins" },
  { value: "lowest", label: "Lowest total wins" },
  { value: "target", label: "First to a target score" },
  { value: "cooperative", label: "Co-op: one team score" },
]

const TYPES: { value: CategoryType; label: string }[] = [
  { value: "number", label: "Number" },
  { value: "count", label: "Count (whole, 0+)" },
  { value: "boolean", label: "Tick box" },
]

// Builds a custom scoresheet in the same format as the built-in ones, with
// a live preview that scores two sample players.
export default function ScoresheetBuilder({ gameName, bggId, editing, titleId, onCancel, onSaved, onDeleted }: Props) {
  const ids = useId()
  const formId = `${ids}-builder`
  const [draft, setDraft] = useState<BuilderDraft>(() => (editing ? draftFromSchema(editing.schema) : emptyDraft(gameName)))
  const [sample, setSample] = useState<Breakdown[]>([{}, {}])
  const [extraRounds, setExtraRounds] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState("")

  const built = useMemo(() => schemaFromDraft(draft, bggId), [draft, bggId])
  const preview = built.ok ? built.schema : null
  const roundCounts = useMemo(() => {
    if (!preview) return {}
    return Object.fromEntries(preview.categories
      .filter((category) => category.scope === "per_round")
      .map((category) => [category.id, Math.max(openRoundCount(sample, category.id), extraRounds[category.id] ?? 1)]))
  }, [preview, sample, extraRounds])
  const scored = preview ? scorePlay(preview, preview.win_condition === "cooperative" ? [sample[0]] : sample) : null

  function update(changes: Partial<BuilderDraft>) {
    setDraft((current) => ({ ...current, ...changes }))
    setSample([{}, {}])
    setError("")
  }

  function updateCategory(key: string, changes: Partial<CategoryDraft>) {
    update({ categories: draft.categories.map((category) => (category.key === key ? { ...category, ...changes } : category)) })
  }

  function moveCategory(index: number, offset: number) {
    const categories = [...draft.categories]
    const [moved] = categories.splice(index, 1)
    categories.splice(index + offset, 0, moved)
    update({ categories })
  }

  function removeCategory(key: string) {
    update({
      categories: draft.categories.filter((category) => category.key !== key),
      tieBreakers: draft.tieBreakers.filter((item) => item !== key),
    })
  }

  function toggleTieBreaker(key: string, on: boolean) {
    const order = draft.categories.map((category) => category.key)
    const keys = on ? [...draft.tieBreakers, key] : draft.tieBreakers.filter((item) => item !== key)
    update({ tieBreakers: order.filter((item) => keys.includes(item)) })
  }

  async function save() {
    if (saving) return
    if (!built.ok) { setError(built.error); return }
    setSaving(true)
    setError("")
    try {
      const sheet = editing ? await updateScoresheet(editing.id, built.schema) : await createScoresheet(built.schema)
      onSaved(sheet)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this scoresheet.")
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!editing || saving) return
    setSaving(true)
    try {
      await deleteScoresheet(editing.id)
      onDeleted(editing.id)
    } catch (err) {
      console.error(err)
      setError("Couldn't delete this scoresheet.")
      setSaving(false)
    }
  }

  const cooperative = draft.winCondition === "cooperative"

  return (
    <>
      <header className="play-sheet-header">
        <button type="button" className="sheet-text-button" onClick={onCancel} disabled={saving}>Back</button>
        <div className="play-sheet-title">
          <span className="play-sheet-title-text">
            <h2 id={titleId}>{editing ? "Edit scoresheet" : "New scoresheet"}</h2>
            <span>{gameName}</span>
          </span>
        </div>
        <button type="submit" form={formId} className="sheet-save-button" disabled={saving} aria-busy={saving} aria-label="Save scoresheet">
          {saving ? "Saving…" : "Save"}
        </button>
      </header>

      <form id={formId} className="play-sheet-form scoresheet-builder" noValidate onSubmit={(event) => { event.preventDefault(); void save() }}>
        <label className="builder-field">
          <span>Name</span>
          <input type="text" maxLength={LIMITS.name} value={draft.name} onChange={(event) => update({ name: event.target.value })} />
        </label>

        <div className="builder-row">
          <label className="builder-field">
            <span>Winner</span>
            <select value={draft.winCondition} onChange={(event) => update({ winCondition: event.target.value as WinCondition })}>
              {WIN_CONDITIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          {draft.winCondition === "target" && (
            <label className="builder-field">
              <span>Target score</span>
              <input type="number" inputMode="decimal" value={draft.targetScore} onChange={(event) => update({ targetScore: event.target.value })} />
            </label>
          )}
          <label className="builder-field">
            <span>Rounds</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              max={LIMITS.rounds}
              placeholder="Any"
              aria-describedby={`${ids}-rounds-help`}
              value={draft.rounds}
              onChange={(event) => update({ rounds: event.target.value })}
            />
          </label>
        </div>
        <p id={`${ids}-rounds-help`} className="builder-help">Leave rounds blank when the number of rounds varies.</p>

        <h3 className="preference-label">Categories · {draft.categories.length}</h3>
        <ol className="builder-categories">
          {draft.categories.map((category, index) => {
            const name = category.label.trim() || `Category ${index + 1}`
            return (
              <li key={category.key} className="builder-category">
                <fieldset>
                  <legend className="sr-only">{name}</legend>
                  <label className="builder-field">
                    <span>Category name</span>
                    <input type="text" maxLength={LIMITS.label} value={category.label} onChange={(event) => updateCategory(category.key, { label: event.target.value })} />
                  </label>
                  <div className="builder-row">
                    <label className="builder-field">
                      <span>Type</span>
                      <select value={category.type} onChange={(event) => updateCategory(category.key, { type: event.target.value as CategoryType })}>
                        {TYPES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="builder-field">
                      <span>Points each</span>
                      <input type="number" inputMode="decimal" value={category.pointsPer} onChange={(event) => updateCategory(category.key, { pointsPer: event.target.value })} />
                    </label>
                  </div>
                  <label className="builder-field">
                    <span>Help (optional)</span>
                    <input type="text" maxLength={LIMITS.help} placeholder="What players should enter" value={category.help} onChange={(event) => updateCategory(category.key, { help: event.target.value })} />
                  </label>
                  <div className="builder-checks">
                    {category.type === "number" && (
                      <label className="builder-check">
                        <input type="checkbox" checked={category.allowNegative} onChange={(event) => updateCategory(category.key, { allowNegative: event.target.checked })} />
                        <span>Can be negative</span>
                      </label>
                    )}
                    {category.type !== "boolean" && (
                      <label className="builder-check">
                        <input type="checkbox" checked={category.perRound} onChange={(event) => updateCategory(category.key, { perRound: event.target.checked })} />
                        <span>Score each round</span>
                      </label>
                    )}
                  </div>
                  <div className="builder-category-actions">
                    <button type="button" className="sheet-text-button" aria-label={`Move ${name} up`} disabled={index === 0} onClick={() => moveCategory(index, -1)}>Up</button>
                    <button type="button" className="sheet-text-button" aria-label={`Move ${name} down`} disabled={index === draft.categories.length - 1} onClick={() => moveCategory(index, 1)}>Down</button>
                    <button type="button" className="sheet-text-button builder-remove" aria-label={`Remove ${name}`} disabled={draft.categories.length === 1} onClick={() => removeCategory(category.key)}>Remove</button>
                  </div>
                </fieldset>
              </li>
            )
          })}
        </ol>
        <button
          type="button"
          className="secondary-button builder-add"
          disabled={draft.categories.length >= LIMITS.categories}
          onClick={() => update({ categories: [...draft.categories, newCategory()] })}
        >
          Add category
        </button>

        {!cooperative && (
          <fieldset className="builder-ties">
            <legend className="preference-label">Ties</legend>
            {draft.categories.map((category, index) => (
              <label key={category.key} className="builder-check">
                <input type="checkbox" checked={draft.tieBreakers.includes(category.key)} onChange={(event) => toggleTieBreaker(category.key, event.target.checked)} />
                <span>Most {category.label.trim() || `category ${index + 1}`} breaks a tie</span>
              </label>
            ))}
            <label className="builder-check">
              <input type="checkbox" checked={draft.sharedTies} onChange={(event) => update({ sharedTies: event.target.checked })} />
              <span>Players still tied share the win</span>
            </label>
          </fieldset>
        )}

        <h3 className="preference-label">Preview</h3>
        {preview && scored ? (
          <ScoresheetGrid
            sheet={preview}
            columns={cooperative ? ["Team"] : ["Player A", "Player B"]}
            breakdowns={cooperative ? [sample[0]] : sample}
            roundCounts={roundCounts}
            scored={scored}
            caption={`Preview of ${preview.name}`}
            onChange={(column, breakdown) => setSample((current) => current.map((item, at) => (at === column ? breakdown : item)))}
            onAddRound={(id) => setExtraRounds((current) => ({ ...current, [id]: (roundCounts[id] ?? 1) + 1 }))}
          />
        ) : (
          <p className="builder-help" role="status">{built.ok ? "" : built.error}</p>
        )}

        {error && <p className="error-message" role="alert">{error}</p>}

        {editing && (
          <div className="builder-delete">
            {confirmDelete
              ? <>
                  <span>Plays already logged keep their scores.</span>
                  <button type="button" className="secondary-button builder-danger" disabled={saving} onClick={() => void remove()}>Delete scoresheet</button>
                  <button type="button" className="sheet-text-button" onClick={() => setConfirmDelete(false)}>Keep</button>
                </>
              : <button type="button" className="sheet-text-button builder-remove" onClick={() => setConfirmDelete(true)}>Delete scoresheet…</button>}
          </div>
        )}
      </form>
    </>
  )
}
