import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react"

export type OverflowMenuItem =
  | { key: string; label: string; onSelect: () => void; destructive?: boolean }
  | { key: string; label: string; href: string }

type Props = {
  // Accessible name of the "…" button, for example "More options for Clockwork Market".
  label: string
  items: OverflowMenuItem[]
}

function Dots() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </svg>
  )
}

// A "…" button with a small menu of secondary actions (SP-UI-04). Items are 44pt rows; a destructive item uses the
// danger colour. Escape, a tap outside or Tab closes it, and focus returns to the button.
function OverflowMenu({ label, items }: Props) {
  const [open, setOpen] = useState(false)
  const [flipped, setFlipped] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("pointerdown", outside)
    return () => document.removeEventListener("pointerdown", outside)
  }, [open])

  // Open upward when the menu would run under the tab bar.
  useLayoutEffect(() => {
    if (!open || !menu.current) {
      setFlipped(false)
      return
    }
    const floor = document.querySelector("nav[aria-label='Primary']")?.getBoundingClientRect().top ?? window.innerHeight
    setFlipped(menu.current.getBoundingClientRect().bottom > floor)
  }, [open])

  function close(returnFocus: boolean) {
    setOpen(false)
    if (returnFocus) trigger.current?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const entries = Array.from(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const index = entries.indexOf(document.activeElement as HTMLElement)
    if (event.key === "Escape") {
      event.preventDefault()
      close(true)
    } else if (event.key === "Tab") {
      setOpen(false)
    } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : -1
      entries[(index + step + entries.length) % entries.length]?.focus()
    }
  }

  return (
    <div className="overflow-menu" ref={root}>
      <button
        type="button"
        ref={trigger}
        className="overflow-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <Dots />
      </button>
      {open && (
        <div
          id={menuId}
          ref={menu}
          role="menu"
          aria-label={label}
          className={flipped ? "overflow-list flipped" : "overflow-list"}
          onKeyDown={onKeyDown}
        >
          {items.map((item) => "href" in item ? (
            <a
              key={item.key}
              role="menuitem"
              className="overflow-item"
              href={item.href}
              target="_blank"
              rel="noreferrer"
              onClick={() => close(false)}
            >
              {item.label}
            </a>
          ) : (
            <button
              type="button"
              key={item.key}
              role="menuitem"
              className={item.destructive ? "overflow-item destructive" : "overflow-item"}
              onClick={() => {
                item.onSelect()
                // A destructive item removes what the button belongs to, so there is nothing to return focus to.
                close(!item.destructive)
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default OverflowMenu
