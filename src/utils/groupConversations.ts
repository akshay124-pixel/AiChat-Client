import { differenceInDays, isToday, isYesterday } from 'date-fns'
import type { ConversationGroup, ConversationSummary } from '@/types'

export function groupConversations(
  conversations: ConversationSummary[],
): ConversationGroup[] {
  const now = new Date()

  const today: ConversationSummary[] = []
  const yesterday: ConversationSummary[] = []
  const prev7: ConversationSummary[] = []
  const older: ConversationSummary[] = []

  for (const conv of conversations) {
    const date = new Date(conv.updated_at)
    if (isToday(date)) {
      today.push(conv)
    } else if (isYesterday(date)) {
      yesterday.push(conv)
    } else if (differenceInDays(now, date) <= 7) {
      prev7.push(conv)
    } else {
      older.push(conv)
    }
  }

  const groups: ConversationGroup[] = []
  if (today.length) groups.push({ label: 'Today', conversations: today })
  if (yesterday.length) groups.push({ label: 'Yesterday', conversations: yesterday })
  if (prev7.length) groups.push({ label: 'Previous 7 days', conversations: prev7 })
  if (older.length) groups.push({ label: 'Older', conversations: older })

  return groups
}
