# Agent Behavioral Guidelines

**Mission**: AI agents working in this repository must follow these rules to maintain code quality and coordination.

## Core Workflow

1. **READ FIRST**: Always check `TASK_QUEUE.md` before starting work
2. **CLAIM TASK**: Update task status to `in-progress` with your agent ID
3. **MINIMAL CHANGES**: Make the smallest change that satisfies acceptance criteria
4. **TEST ALWAYS**: Run verification commands before marking task complete
5. **UPDATE STATUS**: Mark task `completed` in `TASK_QUEUE.md` when done
6. **LOG DECISIONS**: Document significant choices in `DECISIONS.md`

## Development Rules

### Before Making Changes
- Read `PROJECT_CONTEXT.md` for architecture and constraints
- Verify no other agent is working on the same task
- Understand the acceptance criteria fully

### During Development
- **WIP=1**: Work on ONE task at a time
- **Incremental**: Make small, testable commits
- **Test-driven**: Run tests before and after changes
- **No redesigns**: Extend existing patterns, don't rebuild

### Testing Requirements
- **Backend**: Run `pytest tests/test_<feature>.py -v` for unit tests
- **Frontend**: Run `npm run build` to verify TypeScript compilation
- **Integration**: Test actual endpoint/UI behavior when possible
- **Regression**: Ensure existing tests still pass

### Commit Standards
- Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`
- Reference task ID in commit message: `feat: implement X (T-042)`
- Include verification evidence in commit message

## Communication Protocol

### With Users
- Report progress after each major step
- Ask for clarification if acceptance criteria unclear
- Suggest alternatives if task blocks or conflicts arise

### With Other Agents
- Update `TASK_QUEUE.md` status atomically
- Don't modify tasks marked `in-progress` by another agent
- Add blocking issues as dependencies in task description

## Error Handling

### When Tests Fail
1. Read full error output
2. Fix root cause, not symptoms
3. Re-run tests to verify fix
4. Don't commit broken code

### When Blocked
1. Update task status to `blocked` with reason
2. Add blocker details to task description
3. Move to next priority task
4. Notify user of blockage

## Anti-Patterns (NEVER DO THIS)

❌ Skip reading `TASK_QUEUE.md` before starting
❌ Work on multiple tasks simultaneously
❌ Commit without running tests
❌ Redesign working code without approval
❌ Leave tasks in `in-progress` state indefinitely
❌ Modify code outside task scope
❌ Break existing functionality for new features

## Definition of Done

A task is complete when ALL of these are true:

✅ **Functionality**: Code meets acceptance criteria exactly
✅ **Tests Pass**: All verification commands succeed (green)
✅ **No Regressions**: Existing tests still pass
✅ **Code Quality**: Follows existing patterns and style
✅ **Documentation**: Changes reflected in relevant docs
✅ **Status Updated**: `TASK_QUEUE.md` marked `completed`
✅ **Committed**: Changes committed with proper message
✅ **Verified**: User can reproduce acceptance criteria

**CRITICAL**: Never mark a task complete if ANY checkbox above is unchecked.

## Quick Reference

```bash
# Read task queue
cat TASK_QUEUE.md

# Backend tests
cd backend
.venv/Scripts/python -m pytest tests/ -v

# Frontend build
cd frontend
npm run build

# Start servers (for manual testing)
# Backend: cd backend; .venv/Scripts/python -m uvicorn src.api.main:app --reload --port 8001
# Frontend: cd frontend; npm run dev

# Commit format
git commit -m "feat: add X (T-123)

Acceptance:
- Criteria 1 met
- Criteria 2 met

Verification:
pytest tests/test_x.py -v
npm run build
"
```
