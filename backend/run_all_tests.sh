#!/usr/bin/env bash
# ==============================================================================
# FluxChat Enterprise Master Test Runner
# Executes all unit, integration, microservice, and E2E suites across the cluster.
# ==============================================================================

set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_PYTEST="${SCRIPT_DIR}/venv/bin/pytest"
VENV_PYTHON="${SCRIPT_DIR}/venv/bin/python3"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m' # No Color

if [ ! -f "$VENV_PYTEST" ]; then
    echo -e "${RED}[ERROR] Virtual environment pytest not found at ${VENV_PYTEST}${NC}"
    exit 1
fi

TOTAL_PASSED=0
TOTAL_FAILED=0
FAILED_SUITES=()

print_header() {
    echo -e "\n${BLUE}==============================================================================${NC}"
    echo -e "${BOLD}${CYAN}FluxChat Test Suite: $1${NC}"
    echo -e "${BLUE}==============================================================================${NC}"
}

run_suite() {
    local suite_name="$1"
    local run_cwd="$2"
    local pythonpath="$3"
    local test_target="$4"

    print_header "$suite_name"
    echo -e "${YELLOW}Directory: ${run_cwd} | Target: ${test_target}${NC}\n"

    local start_time=$(date +%s)
    if (cd "$run_cwd" && PYTHONPATH="$pythonpath" "$VENV_PYTEST" "$test_target" -v); then
        local duration=$(( $(date +%s) - start_time ))
        echo -e "\n${GREEN}✔ ${suite_name} PASSED (${duration}s)${NC}"
        TOTAL_PASSED=$((TOTAL_PASSED + 1))
    else
        local duration=$(( $(date +%s) - start_time ))
        echo -e "\n${RED}✘ ${suite_name} FAILED (${duration}s)${NC}"
        TOTAL_FAILED=$((TOTAL_FAILED + 1))
        FAILED_SUITES+=("$suite_name")
    fi
}

MODE="${1:-all}"

echo -e "${BOLD}${CYAN}"
echo "  ███████╗██╗     ██╗   ██╗██╗  ██╗ ██████╗██╗  ██╗ █████╗ ████████╗"
echo "  ██╔════╝██║     ██║   ██║╚██╗██╔╝██╔════╝██║  ██║██╔══██╗╚══██╔══╝"
echo "  █████╗  ██║     ██║   ██║ ╚███╔╝ ██║     ███████║███████║   ██║   "
echo "  ██╔══╝  ██║     ██║   ██║ ██╔██╗ ██║     ██╔══██║██╔══██║   ██║   "
echo "  ██║     ███████╗╚██████╔╝██╔╝ ██╗╚██████╗██║  ██║██║  ██║   ██║   "
echo "  ╚═╝     ╚══════╝ ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   "
echo -e "${NC}"
echo -e "${BOLD}Master Test Harness Orchestrator | Mode: ${MODE}${NC}"
echo -e "Started at $(date)\n"

START_ALL=$(date +%s)

# 1. Shared Infrastructure & Security Tests
if [[ "$MODE" == "all" || "$MODE" == "shared" || "$MODE" == "unit" ]]; then
    run_suite "Shared Infrastructure, Security & Redis" "$SCRIPT_DIR" "." "shared/"
fi

# 2. API Gateway Tests
if [[ "$MODE" == "all" || "$MODE" == "gateway" || "$MODE" == "services" ]]; then
    run_suite "API Gateway Service" "$SCRIPT_DIR/services/api-gateway" ".:../.." "tests/"
fi

# 3. Auth Service Tests
if [[ "$MODE" == "all" || "$MODE" == "auth" || "$MODE" == "services" ]]; then
    run_suite "Auth Service" "$SCRIPT_DIR/services/auth-service" ".:../.." "tests/"
fi

# 4. User Service Tests
if [[ "$MODE" == "all" || "$MODE" == "user" || "$MODE" == "services" ]]; then
    run_suite "User Service" "$SCRIPT_DIR/services/user-service" ".:../.." "tests/"
fi

# 5. Chat Service Tests
if [[ "$MODE" == "all" || "$MODE" == "chat" || "$MODE" == "services" ]]; then
    run_suite "Chat Service" "$SCRIPT_DIR/services/chat-service" ".:../.." "tests/"
fi

# 6. Message Service Tests
if [[ "$MODE" == "all" || "$MODE" == "message" || "$MODE" == "services" ]]; then
    run_suite "Message Service" "$SCRIPT_DIR/services/message-service" ".:../.." "tests/"
fi

# 7. WebSocket Service Tests
if [[ "$MODE" == "all" || "$MODE" == "websocket" || "$MODE" == "services" ]]; then
    run_suite "WebSocket Service" "$SCRIPT_DIR/services/websocket-service" ".:../.." "tests/"
fi

# 8. Notification Service Tests
if [[ "$MODE" == "all" || "$MODE" == "notification" || "$MODE" == "services" ]]; then
    run_suite "Notification Service" "$SCRIPT_DIR/services/notification-service" ".:../.." "tests/"
fi

# 9. End-to-End User Journey Tests
if [[ "$MODE" == "all" || "$MODE" == "e2e" ]]; then
    run_suite "E2E Full User Journey Cluster Test" "$SCRIPT_DIR" "." "tests/e2e/test_full_journey.py"
fi

TOTAL_DURATION=$(( $(date +%s) - START_ALL ))

echo -e "\n${BLUE}==============================================================================${NC}"
echo -e "${BOLD}${CYAN}FLUXCHAT TEST HARNESS SUMMARY REPORT${NC}"
echo -e "${BLUE}==============================================================================${NC}"
echo -e "Total Test Suites Run: $((TOTAL_PASSED + TOTAL_FAILED))"
echo -e "${GREEN}Suites Passed: ${TOTAL_PASSED}${NC}"
if [ $TOTAL_FAILED -gt 0 ]; then
    echo -e "${RED}Suites Failed: ${TOTAL_FAILED}${NC}"
    for failed in "${FAILED_SUITES[@]}"; do
        echo -e "  - ${RED}${failed}${NC}"
    done
else
    echo -e "${GREEN}Suites Failed: 0${NC}"
    echo -e "\n${BOLD}${GREEN}✔ ALL TEST SUITES PASSED IN ${TOTAL_DURATION}s! CONGRATULATIONS! 🎉${NC}\n"
fi

if [ $TOTAL_FAILED -gt 0 ]; then
    exit 1
fi
exit 0
