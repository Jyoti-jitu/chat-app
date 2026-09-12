"""
Structured logging configuration for FluxChat User Service.
"""
import logging
import sys

logger = logging.getLogger("FluxChat.UserService")

# Configure logger output format
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[logging.StreamHandler(sys.stdout)],
)
