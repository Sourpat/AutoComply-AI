"""Shared logging configuration placeholder."""

import logging

LOGGER_NAME = "autocomply"


def get_logger() -> logging.Logger:
    """Return a configured logger instance."""

    logger = logging.getLogger(LOGGER_NAME)
    if not logger.handlers:
        handler = logging.StreamHandler()
        formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
        handler.setFormatter(formatter)
        logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    return logger
