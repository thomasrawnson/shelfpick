import { useEffect, useId, useState } from "react"

import { purchaseTip, TIP_PRODUCT_IDS, type PurchaseLayer, type TipProduct, type TipProductId } from "../tip-jar"
import SettingsIcon, { type SettingsIconName } from "./ui/SettingsIcon"
import Sheet from "./ui/Sheet"

export type TipJarPhase =
  | { kind: "loading" }
  | { kind: "load-failed" }
  | { kind: "ready"; message?: string }
  | { kind: "purchasing"; id: TipProductId }
  | { kind: "pending" }
  | { kind: "thanks"; count: number }

const TIP_ICONS: Record<TipProductId, SettingsIconName> = {
  "com.plutonightlabs.shelfpick.tip.coffee": "coffee",
  "com.plutonightlabs.shelfpick.tip.pint": "pint",
  "com.plutonightlabs.shelfpick.tip.gamenight": "dice",
}

export function TipJarContent({ phase, products, onBuy, onRetry }: {
  phase: TipJarPhase
  products: TipProduct[]
  onBuy: (id: TipProductId) => void
  onRetry: () => void
}) {
  if (phase.kind === "thanks") {
    return <div className="tip-jar-body tip-jar-thanks" role="status">
      <strong>Thank you!</strong>
      <p>{phase.count === 1 ? "That's your first tip." : `That's ${phase.count} tips from you.`} It really helps keep ShelfPick going.</p>
      <p className="settings-supporter">Supporter</p>
    </div>
  }
  if (phase.kind === "pending") {
    return <div className="tip-jar-body" role="status">
      <strong>Waiting for approval</strong>
      <p>Your tip is pending, for example while Ask to Buy waits for a parent. It finishes once it's approved, and you won't be charged until then.</p>
    </div>
  }
  const busy = phase.kind === "purchasing"
  return <div className="tip-jar-body">
    <p>Tips help pay for ShelfPick's development and hosting. They don't unlock anything, and ShelfPick Pro is separate.</p>
    {phase.kind === "loading" && <p role="status">Loading tips…</p>}
    {phase.kind === "load-failed" && <div role="alert" className="tip-jar-error">
      <p>Couldn't load tips from the App Store.</p>
      <button type="button" className="secondary-button" onClick={onRetry}>Try again</button>
    </div>}
    {products.length > 0 && <ul className="tip-jar-options" aria-busy={busy}>
      {products.map((product) => <li key={product.id}>
        <button type="button" className="tip-jar-option" disabled={busy} onClick={() => onBuy(product.id)}
          aria-label={`Tip ${product.name}, ${product.price}`}>
          <SettingsIcon name={TIP_ICONS[product.id]} tint="gold" />
          <span className="tip-jar-name">{product.name}</span>
          <span className="tip-jar-price">{busy && phase.id === product.id ? "Purchasing…" : product.price}</span>
        </button>
      </li>)}
    </ul>}
    {phase.kind === "ready" && phase.message && <p className="error-message" role="alert">{phase.message}</p>}
  </div>
}

function TipJarSheet({ layer, onClose, onTipped }: {
  layer: PurchaseLayer
  onClose: () => void
  onTipped: (count: number) => void
}) {
  const titleId = useId()
  const [phase, setPhase] = useState<TipJarPhase>({ kind: "loading" })
  const [products, setProducts] = useState<TipProduct[]>([])
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    layer.loadProducts(TIP_PRODUCT_IDS).then((loaded) => {
      if (!active) return
      setProducts(loaded)
      setPhase(loaded.length ? { kind: "ready" } : { kind: "load-failed" })
    }).catch(() => { if (active) setPhase({ kind: "load-failed" }) })
    return () => { active = false }
  }, [layer, attempt])

  async function buy(id: TipProductId) {
    setPhase({ kind: "purchasing", id })
    const outcome = await purchaseTip(layer, id)
    if (outcome.kind === "thanks") onTipped(outcome.count)
    if (outcome.kind === "cancelled") setPhase({ kind: "ready" })
    else if (outcome.kind === "failed") setPhase({ kind: "ready", message: outcome.message })
    else setPhase(outcome)
  }

  const purchasing = phase.kind === "purchasing"
  return <Sheet labelledBy={titleId} onEscape={() => { if (!purchasing) onClose() }}>
    <header className="play-sheet-header">
      <span />
      <div className="play-sheet-title"><h2 id={titleId}>Tip jar</h2></div>
      <button type="button" className="sheet-text-button sheet-strong" onClick={onClose} disabled={purchasing}>Done</button>
    </header>
    <TipJarContent phase={phase} products={products} onBuy={(id) => { void buy(id) }}
      onRetry={() => { setPhase({ kind: "loading" }); setAttempt((value) => value + 1) }} />
  </Sheet>
}

export default TipJarSheet
