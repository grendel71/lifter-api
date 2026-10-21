import logging
import sys

from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from api.leaderboard.config import PG_DSN
from api.leaderboard.schema import Base

logger = logging.getLogger("microservice.db_init")

engine = create_async_engine(PG_DSN)
Session = async_sessionmaker(engine, expire_on_commit=False)


async def init_db():
    logger.info("Initializing db schema")
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception:
        logger.critical("Failure", exc_info=True)
        sys.exit(1)
