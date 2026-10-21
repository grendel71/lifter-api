import os

from dotenv import load_dotenv

load_dotenv()

REQUIRED_ENV = ["PG_USER", "PG_PASSWORD", "PG_HOST", "PG_PORT", "PG_DB_NAME", "PRIVKEY"]

for key in REQUIRED_ENV:
    if not os.environ.get(key):
        raise OSError(f"Required environment variable {key} is missing or empty.")

PG_DSN = (
    f"postgresql+asyncpg://{os.environ['PG_USER']}:{os.environ['PG_PASSWORD']}"
    f"@{os.environ['PG_HOST']}:{os.environ['PG_PORT']}/{os.environ['PG_DB_NAME']}"
)

PRIVKEY = os.environ["PRIVKEY"]
