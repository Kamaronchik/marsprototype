// Who sees which part of the audit log. This is the only place to change when a role is added.
//
// An action code looks like "group.create": the part before the dot is its area.
// AREAS says which action codes belong to which area.
// ROLE_AUDIT says, for every role that may open the journal:
//   areas  - the areas it sees ('all' = everything, the Admin)
//   actors - whose actions it may filter by (the roles in its areas); omit for "everyone but students"
//
// A role that is not in ROLE_AUDIT has no access to the journal (the route answers 403).
// To add a future role, for example HR or a Director:
//   1. put its role name into requireRole(...) in routes/auditRoutes.js;
//   2. add one line below, such as   HR: { areas: ['hr'], actors: ['Admin', 'HR'] }.
const AREAS = {
  academic: ['group.', 'schedule.', 'attendance.', 'grade.', 'homework.', 'lesson.', 'academic.', 'subject.'],
  finance: ['payment.', 'salary.', 'expense.', 'balance.', 'student.payment_status'],
  hr: ['application.'],
};

// Only the Owner reads these: database triggers, rules, violations and the Owner's own actions.
// The Admin is checked by the Owner, so the Admin must not see them (the principle "nobody checks himself").
const OWNER_ONLY = ['db.', 'rule.', 'violation.', 'owner.'];

const ROLE_AUDIT = {
  Owner: { areas: 'all' },
  Admin: { areas: 'all', hide: OWNER_ONLY },
  AcademicManager: { areas: ['academic', 'hr'], actors: ['Admin', 'Teacher', 'AcademicManager'] },
  Financier: { areas: ['finance'], actors: ['Admin', 'Financier'] },
};

const canOpen = (role) => role in ROLE_AUDIT;

// The action prefixes a role sees, or null for "all of them".
const prefixesFor = (role) => {
  const { areas } = ROLE_AUDIT[role] ?? { areas: [] };
  return areas === 'all' ? null : areas.flatMap((area) => AREAS[area]);
};

// The action prefixes a role must not see even though it sees "all of them".
const hiddenFor = (role) => ROLE_AUDIT[role]?.hide ?? [];

const canSee = (role, action) => {
  if (hiddenFor(role).some((prefix) => action.startsWith(prefix))) return false;
  const prefixes = prefixesFor(role);
  return !prefixes || prefixes.some((prefix) => action.startsWith(prefix));
};

// The roles whose actions the person may filter by; null = everybody but students.
const actorRolesFor = (role) => ROLE_AUDIT[role]?.actors ?? null;

module.exports = { canOpen, prefixesFor, hiddenFor, canSee, actorRolesFor };
