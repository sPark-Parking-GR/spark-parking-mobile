export function formatMoney(cents: number, currency = 'EUR'): string {
  try {
    return new Intl.NumberFormat('el-GR', { style: 'currency', currency }).format(cents / 100)
  } catch {
    return `${(cents / 100).toFixed(2)} €`
  }
}

export function formatPriceShort(cents: number, currency = 'EUR'): string {
  const symbol = currency === 'EUR' ? '€' : currency + ' '
  const value = cents / 100
  const text = Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',')
  return `${symbol}${text}`
}

export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1000).toFixed(1)} km`
}

export function formatDateTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('el-GR', { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    )
  } catch {
    return new Date(iso).toLocaleString()
  }
}

export function formatDateTimeShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat('el-GR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return new Date(iso).toLocaleString()
  }
}

export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatDateTime(startIso)} → ${formatDateTime(endIso)}`
}
