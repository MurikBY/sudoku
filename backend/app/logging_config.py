import logging.config
from typing import Literal

LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR"]


def configure_logging(level: LogLevel) -> None:
    logging.config.dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "plain": {
                    "format": "%(asctime)s %(levelname)s %(name)s %(message)s",
                },
            },
            "handlers": {
                "stream": {
                    "class": "logging.StreamHandler",
                    "formatter": "plain",
                },
            },
            "root": {
                "handlers": ["stream"],
                "level": level,
            },
        },
    )
