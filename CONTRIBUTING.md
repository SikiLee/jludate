# Contributing

## Development Setup
1. Copy `.env.example` to `.env` and fill required values.
2. Start services: `docker compose up --build -d`.
3. Run checks before submitting: `./run_tests.sh`.

## Pull Request Rules
- Keep PRs focused and small.
- Include tests for behavior changes.
- Do not commit secrets, private keys, or real credentials.
- Update `README.md` when behavior or configuration changes.

## Commit Hygiene
- Use clear commit messages.
- Avoid mixing refactors with feature/bug changes in one commit.
