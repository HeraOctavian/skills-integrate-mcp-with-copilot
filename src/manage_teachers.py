"""
Assign or remove teacher accounts in teachers.json.

Usage:
    python manage_teachers.py set <username> [--name "Display Name"]
    python manage_teachers.py remove <username>
    python manage_teachers.py list
"""

import argparse
import getpass
import json
import sys

from auth import TEACHERS_FILE, hash_password


def _load() -> dict:
    if TEACHERS_FILE.exists():
        with TEACHERS_FILE.open() as f:
            return json.load(f)
    return {"teachers": []}


def _save(data: dict) -> None:
    with TEACHERS_FILE.open("w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    set_cmd = sub.add_parser("set", help="Create a teacher or reset their password")
    set_cmd.add_argument("username")
    set_cmd.add_argument("--name", help="Display name shown in the UI")
    rm_cmd = sub.add_parser("remove", help="Remove a teacher")
    rm_cmd.add_argument("username")
    sub.add_parser("list", help="List teacher usernames")
    args = parser.parse_args()

    data = _load()
    teachers = data.setdefault("teachers", [])
    existing = next((t for t in teachers if t["username"] == args.username), None) \
        if args.command != "list" else None

    if args.command == "list":
        for t in teachers:
            print(f"{t['username']}\t{t.get('display_name', '')}")
        return 0

    if args.command == "remove":
        if existing is None:
            print(f"No teacher named {args.username}", file=sys.stderr)
            return 1
        teachers.remove(existing)
        _save(data)
        print(f"Removed {args.username}")
        return 0

    password = getpass.getpass("Password: ")
    if len(password) < 8:
        print("Password must be at least 8 characters", file=sys.stderr)
        return 1
    if password != getpass.getpass("Confirm password: "):
        print("Passwords do not match", file=sys.stderr)
        return 1

    if existing is None:
        existing = {"username": args.username}
        teachers.append(existing)
    if args.name:
        existing["display_name"] = args.name
    existing.setdefault("display_name", args.username)
    existing["password_hash"] = hash_password(password)
    _save(data)
    print(f"Saved teacher {args.username}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
