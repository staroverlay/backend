# Contributing to StarOverlay

StarOverlay follows a fairly specific code design pattern. Try not to break the imposed pattern. Before doing PR please check locally that your changes work and do not break any other feature or mechanic.

## Commit guide

All commit messages must be in lowercase and must have a prefix indicating the type of the modification and an emoji. The commit message must be in English.

### Feature

The **feature** prefix will be used to add new features to the project:
`feature: 🌱 this is a new generic feature`
`feature(lang): 🈁 added ES language`
`feature(cache): ⚡ added redis cache support`
`feature(storage): 🐬 added mysql database support`

### Fix

The **fix** prefix will be used to fix a feature:
`fix: ⚠ login message not showing`
`fix: 🔌 mysql driver doesn't work`
`fix: ⭕ fixes issue #123`

### Docs

The **docs** prefix to add or correct documentation.
`docs: 📚 added new commands to the documentation`
`docs(typo): ✏ correct spelling of documentation`

### Refactor

The **refactor** prefix is used when re-doing from scratch or re-implementing an existing feature. With intentions of improving its code, its performance or its quality.
`refactor: 💻 reimplemented command system`

### Test

The **test** prefix is used to create automated tests.
`test: 🧪 improve unit testing`

### Others

The **chore** prefix is used to modify any file other than CI, source code, or tests.  
The **style** prefix will be used to reformat code. As well as correction of tabs and spaces.

## Code style

The code style must have 2 indentation spaces. Constants must be in uppercase and separated by underscores. The variables must be in camelCase. The functions must be in camelCase. The classes must be in PascalCase.

Modules should be in `src/modules/<module_name>`. Common interfaces and utilities between modules should be in `src/modules/shared`. Common functions should be in `src/utils`.

```javascript
// bad
const myConstant = 1;
let my_variable = 2;
function MyFunction() {}
class my_class {
    // ...
}

// good
const MY_CONSTANT = 1;
let myVariable = 2;
function myFunction() {}
class MyClass {
  // ...
}
```
