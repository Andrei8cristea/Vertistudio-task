import os
import hashlib
import binascii
import sys


def generate_salt(length: int = 16) -> str:
    """
    Generează un salt aleator de `length` bytes, returnat ca hex string.
    """
    return binascii.hexlify(os.urandom(length)).decode()


def hash_password(password: str,
                  salt: str = None,
                  iterations: int = 100_000) -> tuple[str, str]:
    """
    Hash-uiește parola cu PBKDF2-HMAC-SHA256.
    Dacă nu se furnizează salt, se genereză unul nou.
    Returnează tuple(salt, hash_hex).
    """
    if salt is None:
        salt = generate_salt()
    dk = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        iterations
    )
    return salt, binascii.hexlify(dk).decode()


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print('Usage: python3 hash.py <password> [salt]')
        sys.exit(1)
    pwd = sys.argv[1]
    salt_in = sys.argv[2] if len(sys.argv) > 2 else None
    salt, pwd_hash = hash_password(pwd, salt_in)
    # Ieșire: salt și hash separate prin caracterul '$'
    print(f"{salt}${pwd_hash}")