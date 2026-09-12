#!/usr/bin/env python3
"""
FluxChat 12-Factor Environment Auditor & Diagnostic Tool.
Scans cluster configuration, validates secrets, and verifies connection schemas.
"""

import os
import sys
from pathlib import Path
from dotenv import dotenv_values

# Ensure backend root is on sys.path
SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from shared.config.validator import EnvironmentValidator, ConfigValidationError

# ANSI colors
GREEN = "\033[92m"
RED = "\033[91m"
YELLOW = "\033[93m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def print_banner():
    print(f"{BOLD}{CYAN}")
    print("=" * 78)
    print("  FLUXCHAT 12-FACTOR ENVIRONMENT & CONFIGURATION AUDITOR")
    print("=" * 78)
    print(f"{RESET}")


def audit_file(file_path: Path, service_name: str) -> bool:
    print(f"\n{BOLD}▶ Inspecting: {service_name}{RESET} ({file_path})")

    if not file_path.exists():
        print(f"  {YELLOW}⚠ File does not exist: {file_path.name} (will use process env){RESET}")
        return True

    env_values = dotenv_values(file_path)
    if not env_values:
        print(f"  {YELLOW}⚠ File is empty or could not be parsed{RESET}")
        return True

    all_valid = True

    # 1. Check APP_ENV
    app_env = env_values.get("APP_ENV", "development")
    try:
        EnvironmentValidator.validate_app_env(app_env)
        print(f"  {GREEN}✔ APP_ENV: {app_env}{RESET}")
    except ConfigValidationError as e:
        print(f"  {RED}✘ APP_ENV: {e}{RESET}")
        all_valid = False

    # 2. Check MONGODB_URL if present
    mongo_url = env_values.get("MONGODB_URL")
    if mongo_url:
        try:
            EnvironmentValidator.validate_mongodb_url(mongo_url)
            # Mask credentials for display
            masked = mongo_url.split("@")[-1] if "@" in mongo_url else "mongodb://..."
            print(f"  {GREEN}✔ MONGODB_URL: Scheme valid (target: @{masked}){RESET}")
        except ConfigValidationError as e:
            print(f"  {RED}✘ MONGODB_URL: {e}{RESET}")
            all_valid = False

    # 3. Check REDIS_URL if present
    redis_url = env_values.get("REDIS_URL")
    if redis_url:
        try:
            EnvironmentValidator.validate_redis_url(redis_url)
            print(f"  {GREEN}✔ REDIS_URL: Scheme valid ({redis_url}){RESET}")
        except ConfigValidationError as e:
            print(f"  {RED}✘ REDIS_URL: {e}{RESET}")
            all_valid = False

    # 4. Check JWT_SECRET if present
    jwt_secret = env_values.get("JWT_SECRET")
    if jwt_secret:
        try:
            EnvironmentValidator.validate_jwt_secret(jwt_secret, app_env=app_env)
            print(f"  {GREEN}✔ JWT_SECRET: Sufficient entropy ({len(jwt_secret)} chars){RESET}")
        except ConfigValidationError as e:
            print(f"  {RED}✘ JWT_SECRET: {e}{RESET}")
            all_valid = False

    return all_valid


def main():
    print_banner()

    root_dir = SCRIPT_DIR.parent
    services = [
        ("Root Environment", root_dir / ".env"),
        ("Docker Environment Template", root_dir / ".env.docker.example"),
        ("Auth Service", SCRIPT_DIR / "services/auth-service/.env"),
        ("User Service", SCRIPT_DIR / "services/user-service/.env"),
        ("Chat Service", SCRIPT_DIR / "services/chat-service/.env"),
        ("Message Service", SCRIPT_DIR / "services/message-service/.env"),
        ("WebSocket Service", SCRIPT_DIR / "services/websocket-service/.env"),
        ("Notification Service", SCRIPT_DIR / "services/notification-service/.env"),
        ("API Gateway", SCRIPT_DIR / "services/api-gateway/.env"),
        ("Frontend Web Client", root_dir / "frontend/.env.local"),
    ]

    total_checked = 0
    total_passed = 0

    for name, path in services:
        passed = audit_file(path, name)
        total_checked += 1
        if passed:
            total_passed += 1

    print("\n" + "=" * 78)
    if total_passed == total_checked:
        print(f"{BOLD}{GREEN}✔ 12-FACTOR AUDIT COMPLETE: ALL {total_checked} CONFIGURATIONS PASSED!{RESET}")
        sys.exit(0)
    else:
        print(f"{BOLD}{RED}✘ 12-FACTOR AUDIT COMPLETE: {total_checked - total_passed} FAILED CHECKS.{RESET}")
        sys.exit(1)


if __name__ == "__main__":
    main()
