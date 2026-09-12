"""
Contacts and Connection Requests API endpoints for FluxChat.
Protected with shared JWT authorization dependency.
"""
from typing import Any, Dict
from fastapi import APIRouter, Depends, status
from app.schemas.contact import (
    ActionSuccessResponse,
    ContactListResponse,
    ContactRequestListResponse,
    ContactRequestResponse,
    SendContactRequest,
)
from app.services.contact_service import contact_service
from shared.security.dependencies import get_current_user

router = APIRouter(prefix="/contacts", tags=["Contacts"])


@router.get(
    "",
    response_model=ContactListResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Contacts Roster",
    description="Lists all confirmed contacts for the authenticated user.",
)
async def get_contacts(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ContactListResponse:
    """Returns the authenticated user's contact list."""
    return await contact_service.get_contacts(current_user["id"])


@router.delete(
    "/{contact_id}",
    response_model=ActionSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Remove Contact",
    description="Deletes a contact from the roster and removes the bidirectional connection.",
)
async def delete_contact(
    contact_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ActionSuccessResponse:
    """Removes contact relationship."""
    return await contact_service.delete_contact(current_user["id"], contact_id)


@router.post(
    "/requests",
    response_model=ContactRequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Send Connection Request",
    description="Sends a new friend/contact request by user ID or username/email/phone.",
)
async def send_contact_request(
    payload: SendContactRequest,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ContactRequestResponse:
    """Initiates connection request."""
    return await contact_service.send_contact_request(current_user["id"], payload)


@router.get(
    "/requests",
    response_model=ContactRequestListResponse,
    status_code=status.HTTP_200_OK,
    summary="List Connection Requests",
    description="Lists all pending received and sent connection requests with user details.",
)
async def list_requests(
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ContactRequestListResponse:
    """Returns received and sent requests."""
    return await contact_service.list_requests(current_user["id"])


@router.post(
    "/requests/{request_id}/accept",
    response_model=ActionSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Accept Connection Request",
    description="Accepts a pending received request and creates bidirectional contact entries.",
)
async def accept_request(
    request_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ActionSuccessResponse:
    """Accepts request and establishes connection."""
    return await contact_service.accept_request(current_user["id"], request_id)


@router.post(
    "/requests/{request_id}/reject",
    response_model=ActionSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Reject Connection Request",
    description="Rejects a pending received request.",
)
async def reject_request(
    request_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ActionSuccessResponse:
    """Rejects connection request."""
    return await contact_service.reject_request(current_user["id"], request_id)


@router.post(
    "/requests/{request_id}/cancel",
    response_model=ActionSuccessResponse,
    status_code=status.HTTP_200_OK,
    summary="Cancel Sent Request",
    description="Cancels a pending request initiated by the authenticated user.",
)
async def cancel_request(
    request_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> ActionSuccessResponse:
    """Cancels sent request."""
    return await contact_service.cancel_request(current_user["id"], request_id)
