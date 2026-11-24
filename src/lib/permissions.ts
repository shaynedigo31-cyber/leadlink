import type { Membership } from '../context/AuthContext'

// True when this membership is active and its role grants the permission ('*' grants everything).
// This only decides what the screen shows. The database enforces the real rules.
export const can = (m: Membership | undefined, perm: string): boolean =>
  !!m && m.status === 'active' && (m.permissions.includes('*') || m.permissions.includes(perm))