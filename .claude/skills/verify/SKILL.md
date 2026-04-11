---
name: verify
description: Run the aispy verification pipeline — typecheck + test + lint — and report pass/fail per step with output summary. Use this before claiming any change is done, per .claude/rules/self-driving.md. Triggers — "verify", "check everything", "run the pipeline", "is it ready", before /commit, before claiming done.
---

# aispy verification pipeline

Runs the three gates every change must pass before it can be claimed done. This is the automation of `.claude/rules/self-driving.md` §完了宣言の前に必ず走らせる.

## Steps

Execute in sequence (fail fast — stop on first failure):

```bash
npm run typecheck
npm run test
npm run lint
```

If `package.json` doesn't exist yet (pre-scaffold), report "N/A — project not yet scaffolded" for each step and return PASS-NA.

## Reporting format

After running, report exactly like this:

```
## Verify

- **typecheck**: ✓  (or ✗ with first 3 error lines)
- **test**:      ✓  (N passed)  (or ✗ with failing test names)
- **lint**:      ✓  (0 errors)   (or ✗ with first 3 errors)

### Verdict: PASS / FAIL
```

If any step fails, stop the sequence and report the failure. **Do not mark work complete when any gate fails.**

## TUI reminder

This skill cannot automate the TUI render check. For changes that touch `src/ui/` or `src/tui.tsx`, remind the caller:

> "TUI changes also require a manual render check: `npm run dev`, interact with the affected UI, confirm behavior. This skill does not cover that."

## Notes

- This skill does NOT auto-fix. It only reports.
- Do not skip any of the three steps.
- Do not use `--no-verify` or any hook-bypass flags.
- If you want the failing output details, read the raw output from the Bash tool result — this skill only summarizes.
