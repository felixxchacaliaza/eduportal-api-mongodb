export function serializeUser(user: any, extra: Record<string, unknown> = {}) {
  const permissions: Record<string, 'FULL' | 'READ_ONLY'> = {};
  for (const opt of user.profile?.options ?? []) {
    permissions[opt.optionKey] = opt.level === 'READ_ONLY' ? 'READ_ONLY' : 'FULL';
  }
  return {
    id: user._id || user.id,
    name: user.name,
    email: user.email,
    dni: user.dni,
    role: user.role,
    cargo: user.cargo,
    specialty: user.specialty,
    status: user.status,
    appAccess: user.appAccess,
    webAccess: user.webAccess,
    mustChangePassword: user.mustChangePassword,
    avatarUrl: user.avatarUrl,
    profileId: user.profileId,
    profileName: user.profile?.name ?? null,
    studentId: user.studentId,
    teacherId: user.teacherId,
    options: Object.keys(permissions),
    permissions,
    createdAt: user.createdAt,
    ...extra
  };
}

export function serializeProfile(profile: any) {
  const permissions: Record<string, 'FULL' | 'READ_ONLY'> = {};
  for (const o of profile.options ?? []) {
    permissions[o.optionKey] = o.level === 'READ_ONLY' ? 'READ_ONLY' : 'FULL';
  }
  return {
    id: profile._id || profile.id,
    name: profile.name,
    description: profile.description,
    icon: profile.icon,
    colorClass: profile.colorClass,
    isSystem: profile.isSystem,
    status: profile.status || 'ACTIVE',
    options: Object.keys(permissions),
    permissions,
    createdAt: profile.createdAt
  };
}
