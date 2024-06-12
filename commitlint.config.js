module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Reglas personalizadas
    'type-enum': [
      2,
      'always',
      ['feature', 'fix', 'docs', 'style', 'refactor', 'test', 'chore', 'perf'],
    ],
    'subject-case': [2, 'always', 'sentence-case'],
    'scope-case': [2, 'always', 'kebab-case'],
  },
};
