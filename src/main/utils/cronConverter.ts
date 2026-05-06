import type { ScheduleFrequency } from '../../shared/types'

/**
 * Converts user-friendly schedule settings to a cron expression.
 * @param frequency - 'daily', 'weekly', or 'custom-days'
 * @param time - Time in HH:MM format (e.g., "02:00")
 * @param days - Array of day numbers (0=Sunday, 1=Monday, ..., 6=Saturday)
 * @returns Cron expression string
 */
export function toCronExpression(
  frequency: ScheduleFrequency,
  time: string,
  days: number[]
): string {
  const [hours, minutes] = time.split(':').map(Number)

  switch (frequency) {
    case 'daily':
      // Run every day at specified time
      return `${minutes} ${hours} * * *`

    case 'weekly':
      // Run once a week on the first selected day
      if (days.length === 0) return `${minutes} ${hours} * * 1` // Default to Monday
      return `${minutes} ${hours} * * ${days[0]}`

    case 'custom-days':
      // Run on specific days of the week
      if (days.length === 0) return `${minutes} ${hours} * * 1` // Default to Monday
      const sortedDays = [...days].sort((a, b) => a - b)
      return `${minutes} ${hours} * * ${sortedDays.join(',')}`

    default:
      return `${minutes} ${hours} * * *` // Fallback to daily
  }
}

/**
 * Attempts to parse a cron expression into user-friendly settings.
 * This is for backward compatibility with existing cron strings.
 * @param cronExpr - Cron expression (e.g., "0 2 * * *")
 * @returns Object with frequency, time, and days
 */
export function fromCronExpression(cronExpr: string): {
  frequency: ScheduleFrequency
  time: string
  days: number[]
} {
  const parts = cronExpr.trim().split(/\s+/)
  if (parts.length < 5) {
    // Invalid cron, return defaults
    return { frequency: 'daily', time: '02:00', days: [1] }
  }

  const [minutes, hours, , , dayOfWeek] = parts

  const min = parseInt(minutes, 10) || 0
  const hr = parseInt(hours, 10) || 2
  const time = `${hr.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`

  // Check day of week pattern
  if (dayOfWeek === '*') {
    // Daily schedule
    return { frequency: 'daily', time, days: [] }
  }

  // Parse day numbers (can be comma-separated or single)
  const dayNumbers = dayOfWeek
    .split(',')
    .map((d) => parseInt(d.trim(), 10))
    .filter((d) => !isNaN(d) && d >= 0 && d <= 6)

  if (dayNumbers.length === 1) {
    return { frequency: 'weekly', time, days: dayNumbers }
  } else if (dayNumbers.length > 1) {
    return { frequency: 'custom-days', time, days: dayNumbers }
  }

  // Fallback
  return { frequency: 'daily', time, days: [] }
}
