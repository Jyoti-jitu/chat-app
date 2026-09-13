"""
Media Upload API Route for FluxChat API Gateway.
Provides centralized, authenticated endpoints for uploading images, documents,
and media directly to Cloudinary with secure URLs and metadata.
"""
import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel

from shared.media.cloudinary_service import cloudinary_service
from shared.security.dependencies import get_current_user

logger = logging.getLogger("FluxChat.Gateway.Media")

router = APIRouter(prefix="/media", tags=["media"])


class Base64UploadPayload(BaseModel):
    """Payload for uploading a base64 or Data URI string directly."""
    data_uri: str
    filename: Optional[str] = "image.jpg"
    folder: Optional[str] = "fluxchat/media"


@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload_media_file(
    file: Optional[UploadFile] = File(None),
    folder: Optional[str] = Form("fluxchat/media"),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Uploads a multipart form file to Cloudinary.
    Requires authenticated user bearer token.
    """
    if not file:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No file provided in form-data 'file' field.",
        )

    try:
        content = await file.read()
        if not content:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        filename = file.filename or "attachment.bin"
        content_type = file.content_type or "application/octet-stream"

        result = cloudinary_service.upload_file(
            file_bytes=content,
            filename=filename,
            content_type=content_type,
            folder=folder or "fluxchat/media",
        )
        return result
    except HTTPException:
        raise
    except Exception as err:
        logger.error(f"Media upload encountered error: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload media to Cloudinary: {str(err)}",
        )


@router.post("/upload-base64", status_code=status.HTTP_201_CREATED)
async def upload_media_base64(
    payload: Base64UploadPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    """
    Uploads a Base64 / Data URI string directly to Cloudinary.
    """
    if not payload.data_uri:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Field 'data_uri' is required.",
        )

    try:
        result = cloudinary_service.upload_base64_data_uri(
            data_uri=payload.data_uri,
            filename=payload.filename,
            folder=payload.folder or "fluxchat/media",
        )
        return result
    except Exception as err:
        logger.error(f"Base64 media upload error: {err}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process image: {str(err)}",
        )
