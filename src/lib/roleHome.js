// The first page of every role after signing in. Most roles use their own name ("/teacher"),
// the academic manager is shorter: "/academic", the auditor works in the CEO panel: "/owner".
const HOME = { AcademicManager: '/academic', Auditor: '/owner' };

export const homePath = (role) => HOME[role] ?? `/${role?.toLowerCase() || 'student'}`;
