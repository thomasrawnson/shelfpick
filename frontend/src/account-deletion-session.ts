import { clearToken } from "./auth.ts"

export async function deleteAccountAndClearSession(
  password: string,
  deleteAccount: (password: string) => Promise<unknown>,
  onDeleted?: () => void,
): Promise<void> {
  await deleteAccount(password)
  try {
    await clearToken()
  } finally {
    onDeleted?.()
  }
}
