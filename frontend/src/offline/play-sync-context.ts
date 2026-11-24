import { createContext, useContext } from "react"

import type { Play } from "../api/client"
import type { MutationResult, PlayPayload, QueuedPlay } from "./play-queue"

export type NewPlay = Omit<PlayPayload, "client_id">

export type SubmitResult =
  | { status: "synced"; play: Play }
  | { status: "queued"; clientId: string }

export type PlaySync = {
  items: QueuedPlay[]
  waiting: number
  failed: QueuedPlay[]
  syncing: boolean
  // Counts up each time at least one queued play reached the server, so screens can reload.
  syncedVersion: number
  syncNow: () => Promise<void>
  submitPlay: (play: NewPlay) => Promise<SubmitResult>
  updateQueued: (clientId: string, changes: Partial<NewPlay>) => Promise<MutationResult>
  discardQueued: (clientId: string) => Promise<MutationResult>
  retryQueued: (clientId: string) => Promise<MutationResult>
}

export const PlaySyncContext = createContext<PlaySync | null>(null)

export function usePlaySync(): PlaySync {
  const value = useContext(PlaySyncContext)
  if (!value) throw new Error("usePlaySync needs a PlaySyncProvider")
  return value
}
