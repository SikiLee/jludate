#!/bin/bash
set -euo pipefail

LOG_FILE="test_results.log"
: > "$LOG_FILE"

TOTAL=0
PASSED=0
FAILED=0

run_step() {
  local name="$1"
  shift

  TOTAL=$((TOTAL + 1))
  echo ">>> ${name}" | tee -a "$LOG_FILE"
  if "$@" >>"$LOG_FILE" 2>&1; then
    PASSED=$((PASSED + 1))
    echo "PASS: ${name}" | tee -a "$LOG_FILE"
  else
    FAILED=$((FAILED + 1))
    echo "FAIL: ${name}" | tee -a "$LOG_FILE"
  fi
  echo "" | tee -a "$LOG_FILE"
}

echo "Starting SZUDate Verification Suite..." | tee -a "$LOG_FILE"

run_step "Install backend dependencies" npm install --prefix backend
run_step "Install frontend dependencies" npm install --prefix frontend
run_step "Run unit tests (ROSE engine)" /bin/zsh -lc 'node --test unit_tests/*.mjs'
run_step "Build backend (Next.js API server)" npm run build --prefix backend
run_step "Build frontend (Vite SPA)" npm run build --prefix frontend
run_step "Docker compose up" /bin/zsh -lc 'ALLOW_TEST_TRIGGER=true SMTP_ENABLED=false EXPOSE_VERIFICATION_CODE_FOR_TESTS=true docker compose up --build -d --remove-orphans'
run_step "Wait for backend health" /bin/zsh -lc 'for i in {1..40}; do curl -fsS http://127.0.0.1:8000/health >/dev/null 2>&1 && exit 0; sleep 2; done; exit 1'
run_step "Wait for frontend availability" /bin/zsh -lc 'for i in {1..30}; do curl -fsS http://127.0.0.1:8383 >/dev/null 2>&1 && exit 0; sleep 2; done; exit 1'
run_step "Run API tests" /bin/zsh -lc 'BASE_URL=http://127.0.0.1:8000/api node --test API_tests/test_api.mjs'

cat "$LOG_FILE"

echo ""
echo "======================================"
echo "          Test Summary                "
echo "======================================"
echo "Total Checks: $TOTAL"
echo "Passed: $PASSED"
echo "Failed: $FAILED"
echo "======================================"

if [ "$FAILED" -ne 0 ]; then
  echo "Verification failed. Please review ${LOG_FILE}."
  exit 1
fi

echo "All checks passed successfully!"
