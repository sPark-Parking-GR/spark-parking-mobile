export function idempotencyKey(): string {
  const rand = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
  return `${Date.now().toString(16)}-${rand()}-${rand()}`
}
