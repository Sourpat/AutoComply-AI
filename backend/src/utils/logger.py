import logging
import sys
from pythonjsonlogger import jsonlogger


def get_logger(name: str = "autocomply") -> logging.Logger:
    """
    Centralized structured logger for AutoComply AI.
    - JSON logs for clean observability
    - Works with LangChain / LangGraph tracing later
    - Zero-op for production environments
    """

    logger = logging.getLogger(name)

    if logger.handlers:
        return logger  # avoid duplicate handlers

    logger.setLevel(logging.INFO)

    handler = logging.StreamHandler(sys.stdout)
    formatter = jsonlogger.JsonFormatter(
        "%(asctime)s %(levelname)s %(name)s %(message)s"
    )
    handler.setFormatter(formatter)

    logger.addHandler(handler)
    logger.propagate = False
    return logger
