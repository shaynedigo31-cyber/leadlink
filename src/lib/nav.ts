import {
  Bell, CalendarDays, Compass, FolderKanban, Folders, GraduationCap,
  History, LayoutDashboard, Megaphone, Repeat, Settings, UserCircle, Users, Building2, Mail, Send, Award,
} from 'lucide-react'
import { ShieldCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = { label: string; to: string; icon: LucideIcon }

export const personalNav: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'My organizations', to: '/my-organizations', icon: Building2 },
  { label: 'Discover', to: '/discover', icon: Compass },
  { label: 'Invitations', to: '/invitations', icon: Mail },
  { label: 'My requests', to: '/my-requests', icon: Send },
  { label: 'Notifications', to: '/notifications', icon: Bell },
  { label: 'Profile', to: '/profile', icon: UserCircle },
  { label: 'Settings', to: '/settings', icon: Settings },
]

export const orgNav = (orgId: string): NavItem[] => [
  { label: 'Dashboard', to: `/org/${orgId}/dashboard`, icon: LayoutDashboard },
  { label: 'Members', to: `/org/${orgId}/members`, icon: Users },
  { label: 'Officers', to: `/org/${orgId}/officers`, icon: Award },
  { label: 'Activity Log', to: `/org/${orgId}/activity`, icon: History },
  { label: 'Events', to: `/org/${orgId}/events`, icon: CalendarDays },
  { label: 'Projects', to: `/org/${orgId}/projects`, icon: FolderKanban },
  { label: 'Announcements', to: `/org/${orgId}/announcements`, icon: Megaphone },
  { label: 'Library', to: `/org/${orgId}/library`, icon: Folders },
  { label: 'Legacy', to: `/org/${orgId}/legacy`, icon: History },
  { label: 'LEADSPIRE', to: `/org/${orgId}/leadspire`, icon: GraduationCap },
  { label: 'Turnover', to: `/org/${orgId}/turnover`, icon: Repeat },
  { label: 'Settings', to: `/org/${orgId}/settings`, icon: Settings },
]



export const adminNav: NavItem[] = [
  { label: 'Approvals', to: '/admin/approvals', icon: ShieldCheck },
]
