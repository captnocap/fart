# App+Lib vs Widget — Parity Test

Proves that a chad widget (everything in one file) produces identical output to the same thing split into an app with a lib. Widget is just app+lib in one file — the compiler must generate the same code either way.

## Colors (4)
- Background: #0f172a
- Card: #1e293b
- Text: #e2e8f0
- Accent: #3b82f6

## Module: math_utils
- add(a, b): returns a + b
- multiply(a, b): returns a * b
- clamp(val, min, max): returns clamped value

## State (3)
- inputA: number, default 5
- inputB: number, default 3
- result: number, default 0

## Functions (5)
- doAdd: result = math_utils.add(inputA, inputB)
- doMultiply: result = math_utils.multiply(inputA, inputB)
- doClamp: result = math_utils.clamp(inputA, 0, 10)
- incA: inputA + 1
- incB: inputB + 1

## Layout
- Full width/height, column, centered
- Title: "Math Utils"
- Row showing inputA and inputB with increment buttons
- Row of 3 operation buttons: [Add] [Multiply] [Clamp]
- Result display

## Two implementations

### app/ (split)
- `calculator.tsz` — `<calculator app>` with one page
- `main.tsz` — `<main page>` with the UI
- `math.tsz` — `<math lib>` containing the module
- `math_utils.mod.tsz` — `<math_utils module>` with the functions

### widget/ (monolith)
- `calculator.tsz` — `<calculator widget>` with everything inline: module functions as regular functions, state, UI — one file
