#!/usr/bin/env python3
"""Genera un hash bcrypt para usarlo como APP_PASSWORD_HASH en .env.

Uso:
    python scripts/hash_password.py "mi-contraseña-secreta"
"""
import sys

import bcrypt


def main() -> None:
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    password = sys.argv[1]
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    print(hashed)


if __name__ == "__main__":
    main()
