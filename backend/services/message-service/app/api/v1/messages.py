"""
Message API endpoints for FluxChat.
Protected by shared JWT authorization dependency.
"""
from typing import Any, Dict
from fastapi import APIRouter, Depends, Query, status
from app.schemas.message import (
    EditMessagePayload,
    MessageListResponse,
    MessageResponse,
    SendMessagePayload,
)
from app.services.message_service import message_service
from shared.security.dependencies import get_current_user

router = APIRouter(tags=["Messages"])


@router.post(
    "/conversations/{conversation_id}/messages",
    response_model=MessageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send Message",
    description="Persists a new message in a conversation thread. Validates sender membership.",
)
async def send_message(
    conversation_id: str,
    payload: SendMessagePayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> MessageResponse:
    """Sends a message."""
    return await message_service.send_message(
        current_user["id"], conversation_id, payload
    )


@router.get(
    "/conversations/{conversation_id}/messages",
    response_model=MessageListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Thread Messages",
    description="Retrieves messages for a conversation thread sorted chronologically.",
)
async def get_messages(
    conversation_id: str,
    limit: int = Query(100, ge=1, le=200),
    skip: int = Query(0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> MessageListResponse:
    """Lists messages."""
    return await message_service.get_messages(
        current_user["id"], conversation_id, limit=limit, skip=skip
    )


@router.patch(
    "/messages/{message_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Edit Message",
    description="Edits a message in place and sets the edited flag. Caller must be message author.",
)
async def edit_message(
    message_id: str,
    payload: EditMessagePayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> MessageResponse:
    """Edits message."""
    return await message_service.edit_message(
        current_user["id"], message_id, payload
    )


@router.delete(
    "/messages/{message_id}",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Soft Delete Message",
    description="Soft deletes a message, preserving thread ordering. Caller must be message author.",
)
async def delete_message(
    message_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> MessageResponse:
    """Soft deletes message."""
    return await message_service.delete_message(
        current_user["id"], message_id
    )


@router.post(
    "/messages/{message_id}/read",
    response_model=MessageResponse,
    status_code=status.HTTP_200_OK,
    summary="Mark Message Read",
    description="Updates message status to read.",
)
async def mark_as_read(
    message_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> MessageResponse:
    """Marks message as read."""
    return await message_service.mark_message_as_read(
        current_user["id"], message_id
    )
