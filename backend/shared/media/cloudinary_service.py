"""
Cloudinary Media Service for FluxChat.
Handles image, video, and file uploads to Cloudinary with secure URLs,
metadata extraction, and graceful local fallback when credentials are not configured.
"""
import base64
import io
import logging
import os
import uuid
from typing import Any, Dict, Optional

logger = logging.getLogger("FluxChat.Shared.Cloudinary")

# Read Cloudinary configuration
CLOUDINARY_CLOUD_NAME = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
CLOUDINARY_API_KEY = os.getenv("CLOUDINARY_API_KEY", "").strip()
CLOUDINARY_API_SECRET = os.getenv("CLOUDINARY_API_SECRET", "").strip()
CLOUDINARY_URL = os.getenv("CLOUDINARY_URL", "").strip()

_cloudinary_initialized = False


def _init_cloudinary():
    """Initializes Cloudinary SDK with environment credentials if available."""
    global _cloudinary_initialized
    if _cloudinary_initialized:
        return

    try:
        # Attempt to load from backend/.env if not present
        if not os.getenv("CLOUDINARY_URL") and not os.getenv("CLOUDINARY_API_KEY"):
            try:
                from dotenv import load_dotenv
                current_file = os.path.abspath(__file__)
                # Navigate up from shared/media to backend root
                backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(current_file)))
                candidate_envs = [
                    os.path.join(backend_dir, ".env"),
                    os.path.join(os.getcwd(), ".env"),
                    os.path.join(os.getcwd(), "backend", ".env"),
                ]
                for c_env in candidate_envs:
                    if os.path.exists(c_env):
                        load_dotenv(c_env)
                        break
            except Exception:
                pass

        c_url = os.getenv("CLOUDINARY_URL", "").strip()
        c_name = os.getenv("CLOUDINARY_CLOUD_NAME", "").strip()
        c_key = os.getenv("CLOUDINARY_API_KEY", "").strip()
        c_secret = os.getenv("CLOUDINARY_API_SECRET", "").strip()

        import cloudinary

        if c_url:
            cloudinary.config(cloudinary_url=c_url)
            _cloudinary_initialized = True
            logger.info("Cloudinary initialized via CLOUDINARY_URL.")
        elif c_name and c_key and c_secret:
            cloudinary.config(
                cloud_name=c_name,
                api_key=c_key,
                api_secret=c_secret,
                secure=True,
            )
            _cloudinary_initialized = True
            logger.info(f"Cloudinary initialized for cloud: {c_name}")
        else:
            logger.warning(
                "Cloudinary credentials not set in environment. Set CLOUDINARY_CLOUD_NAME, "
                "CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env for production storage."
            )
    except Exception as err:
        logger.error(f"Failed to initialize Cloudinary SDK: {err}")


def is_cloudinary_configured() -> bool:
    """Returns True if Cloudinary credentials are provided and SDK initialized."""
    _init_cloudinary()
    return _cloudinary_initialized


def format_bytes(size: int) -> str:
    """Formats raw byte count into human-readable size string."""
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    return f"{size / (1024 * 1024):.1f} MB"


class CloudinaryMediaService:
    """Centralized service for uploading media (images, avatars, attachments) to Cloudinary."""

    def __init__(self):
        _init_cloudinary()

    def upload_file(
        self,
        file_bytes: bytes,
        filename: str,
        content_type: str = "application/octet-stream",
        folder: str = "fluxchat/media",
    ) -> Dict[str, Any]:
        """
        Uploads binary file data to Cloudinary.
        Falls back to safe base64 Data URI if Cloudinary is not configured.
        """
        _init_cloudinary()
        size_bytes = len(file_bytes)
        size_str = format_bytes(size_bytes)
        is_image = content_type.startswith("image/") or filename.lower().endswith(
            (".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".bmp")
        )
        media_type = "image" if is_image else "file"

        if _cloudinary_initialized:
            try:
                import cloudinary.uploader

                resource_type = "image" if is_image else "auto"
                upload_result = cloudinary.uploader.upload(
                    file_bytes,
                    folder=folder,
                    resource_type=resource_type,
                    use_filename=True,
                    unique_filename=True,
                )

                secure_url = upload_result.get("secure_url") or upload_result.get("url")
                public_id = upload_result.get("public_id")
                fmt = upload_result.get("format", filename.split(".")[-1] if "." in filename else "bin")

                logger.info(f"Uploaded file '{filename}' to Cloudinary: {secure_url}")
                return {
                    "status": "ok",
                    "url": secure_url,
                    "secure_url": secure_url,
                    "public_id": public_id,
                    "name": filename,
                    "size": size_str,
                    "bytes": size_bytes,
                    "type": media_type,
                    "format": fmt,
                }
            except Exception as err:
                logger.error(f"Cloudinary upload failed for '{filename}': {err}")
                # Fall through to fallback

        # Fallback: Data URI representation
        logger.info(f"Cloudinary not connected; utilizing responsive data URI for '{filename}'")
        b64 = base64.b64encode(file_bytes).decode("utf-8")
        data_uri = f"data:{content_type};base64,{b64}"
        return {
            "status": "ok",
            "url": data_uri,
            "secure_url": data_uri,
            "public_id": f"local_{uuid.uuid4().hex[:10]}",
            "name": filename,
            "size": size_str,
            "bytes": size_bytes,
            "type": media_type,
            "format": filename.split(".")[-1] if "." in filename else "bin",
        }

    def upload_base64_data_uri(
        self,
        data_uri: str,
        filename: Optional[str] = None,
        folder: str = "fluxchat/media",
    ) -> Dict[str, Any]:
        """
        Uploads a base64 or Data URI string directly to Cloudinary.
        """
        _init_cloudinary()

        # Check if already a remote HTTP URL
        if data_uri.startswith("http://") or data_uri.startswith("https://"):
            return {
                "status": "ok",
                "url": data_uri,
                "secure_url": data_uri,
                "public_id": "remote_url",
                "name": filename or "image.jpg",
                "size": "Unknown",
                "bytes": 0,
                "type": "image",
                "format": "jpg",
            }

        if _cloudinary_initialized:
            try:
                import cloudinary.uploader

                upload_result = cloudinary.uploader.upload(
                    data_uri,
                    folder=folder,
                    resource_type="image",
                )
                secure_url = upload_result.get("secure_url") or upload_result.get("url")
                public_id = upload_result.get("public_id")
                fmt = upload_result.get("format", "jpg")
                bytes_count = upload_result.get("bytes", len(data_uri))

                logger.info(f"Uploaded base64 media to Cloudinary: {secure_url}")
                return {
                    "status": "ok",
                    "url": secure_url,
                    "secure_url": secure_url,
                    "public_id": public_id,
                    "name": filename or f"media_{public_id}.{fmt}",
                    "size": format_bytes(bytes_count),
                    "bytes": bytes_count,
                    "type": "image",
                    "format": fmt,
                }
            except Exception as err:
                logger.error(f"Cloudinary base64 upload failed: {err}")

        # Fallback to returning the data URI
        return {
            "status": "ok",
            "url": data_uri,
            "secure_url": data_uri,
            "public_id": f"local_{uuid.uuid4().hex[:10]}",
            "name": filename or "image.jpg",
            "size": format_bytes(len(data_uri)),
            "bytes": len(data_uri),
            "type": "image",
            "format": "jpg",
        }


cloudinary_service = CloudinaryMediaService()
