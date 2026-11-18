import { createContext, useContext, type ReactNode } from "react"

// The signed-in account's server entitlements, for features that are hidden
// from Free accounts. The server enforces every gate again.
const EntitlementsContext = createContext<readonly string[]>([])

export function EntitlementsProvider({ entitlements, children }: { entitlements: readonly string[]; children: ReactNode }) {
  return <EntitlementsContext.Provider value={entitlements}>{children}</EntitlementsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useEntitlement(feature: string): boolean {
  return useContext(EntitlementsContext).includes(feature)
}
