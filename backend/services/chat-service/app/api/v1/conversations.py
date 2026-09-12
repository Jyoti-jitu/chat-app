"""
Conversation API endpoints for FluxChat.
Protected by shared JWT authorization dependency.
"""
from typing import Any, Dict
from fastapi import APIRouter, Depends, Query, status
from app.schemas.conversation import (
    ActionSuccessResponse,
    AddMembersPayload,
    ConversationListResponse,
    ConversationResponse,
    CreateDirectConversation,
    CreateGroupConversation,
    UpdateGroupConversation,
)
from app.services.conversation_service import conversation_service
from shared.security.dependencies import get_current_user

router = APIRouter(prefix="/conversations", tags=["Conversations"])


@router.post(
    "/direct",
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
    summary="Create or Retrieve Direct Chat",
    description="Initiates a 1:1 direct chat or retrieves the existing conversation thread if one already exists.",
)
async def get_or_create_direct_chat(
    payload: CreateDirectConversation,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ConversationResponse:
    """Gets or creates direct conversation."""
    return await conversation_service.get_or_create_direct_conversation(
        current_user["id"], payload
    )


@router.post(
    "/group",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create Group Conversation",
    description="Creates a new named group conversation with initial participants.",
)
async def create_group_chat(
    payload: CreateGroupConversation,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ConversationResponse:
    """Creates group conversation."""
    return await conversation_service.create_group_conversation(
        current_user["id"], payload
    )


@router.get(
    "",
    response_model=ConversationListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Conversations",
    description="Lists all direct and group conversations the user is a member of, sorted by latest activity.",
)
async def list_conversations(
    limit: int = Query(50, ge=1, le=100),
    skip: int = Query(0, ge=0),
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ConversationListResponse:
    """Lists conversations."""
    return await conversation_service.list_user_conversations(
        current_user["id"], limit=limit, skip=skip
    )


@router.get(
    "/{conversation_id}",
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Conversation Details",
    description="Retrieves details and participants for a specific conversation.",
)
async def get_conversation(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ConversationResponse:
    """Retrieves conversation."""
    return await conversation_service.get_conversation(
        current_user["id"], conversation_id
    )


@router.patch(
    "/{conversation_id}",
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
    summary="Update Group Metadata",
    description="Updates group title or avatar. Caller must be a conversation admin.",
)
async def update_group(
    conversation_id: str,
    payload: UpdateGroupConversation,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ConversationResponse:
    """Updates group metadata."""
    return await conversation_service.update_group_conversation(
        current_user["id"], conversation_id, payload
    )


@router.post(
    "/{conversation_id}/members",
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
    summary="Add Members to Group",
    description="Adds one or more participants to an existing group conversation.",
)
async def add_members(
    conversation_id: str,
    payload: AddMembersPayload,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ConversationResponse:
    """Adds participants."""
    return await conversation_service.add_members(
        current_user["id"], conversation_id, payload
    )


@router.delete(
    "/{conversation_id}/members/{target_user_id}",
    response_model=ConversationResponse,
    status_code=status.HTTP_200_OK,
    summary="Remove Member from Group",
    description="Removes a participant from a group. Caller must be an admin.",
)
async def remove_member(
    conversation_id: str,
    target_user_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ConversationResponse:
    """Removes participant."""
    return await conversation_service.remove_member(
        current_user["id"], conversation_id, target_user_id
    )


@router.post(
    "/{conversation_id}/leave",
    response_model=ActionSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Leave Conversation",
    description="Voluntarily removes the authenticated user from the conversation.",
)
async def leave_conversation(
    conversation_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ActionSuccessResponse:
    """Leaves conversation."""
    return await conversation_service.leave_conversation(
        current_user["id"], conversation_id
    )
