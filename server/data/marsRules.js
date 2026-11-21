// The internal rules of Mars for mentors, version 27.04.2026 (see docs/mars-rules-mentor.md).
// An auditor picks one of them when giving a penalty. The texts of the rules are in the language files
// (penalty.rule.MARS_1_1 ...), here only the number and the level.
// level: reminder | green | yellow | red | black

const RULES = [
  ['1.1', 'reminder'], ['1.2', 'reminder'], ['1.3', 'green'],
  ['2.1', 'yellow'], ['2.2', 'yellow'], ['2.3', 'yellow'], ['2.4', 'yellow'], ['2.5', 'yellow'], ['2.6', 'yellow'], ['2.7', 'yellow'],
  ['3.1', 'red'], ['3.2', 'red'], ['3.3', 'red'], ['3.4', 'red'], ['3.5', 'red'], ['3.6', 'red'],
  ['3.7', 'red'], ['3.8', 'red'], ['3.9', 'red'], ['3.10', 'red'], ['3.11', 'red'],
  ['4.1', 'black'], ['4.2', 'black'], ['4.3', 'black'], ['4.4', 'black'],
];

// How serious a level is, in the words of the audit_rules table.
const SEVERITY = { reminder: 'low', green: 'low', yellow: 'medium', red: 'high', black: 'critical' };

const MARS_RULES = RULES.map(([number, level]) => ({
  code: `MARS_${number.replace('.', '_')}`,
  number,
  level,
  severity: SEVERITY[level],
}));

const findMarsRule = (code) => MARS_RULES.find((rule) => rule.code === code) ?? null;

module.exports = { MARS_RULES, findMarsRule };
