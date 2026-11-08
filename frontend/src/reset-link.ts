export function resetTokenFromSearch(search: string): string {
  return new URLSearchParams(search).get("token") ?? ""
}

export function resetConfirmationBody(token: string, password: string): string {
  return JSON.stringify({ token, password })
}
