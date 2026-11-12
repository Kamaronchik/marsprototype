// The first page of every role after signing in. Most roles use their own name ("/teacher"),
// the academic manager is shorter: "/academic".
const HOME = { AcademicManager: '/academic' };

export const homePath = (role) => HOME[role] ?? `/${role?.toLowerCase() || 'student'}`;
