"""
Contact Service business logic layer.
Handles request lifecycle, duplicate detection, acceptance/rejection, roster population.
"""
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, status
from app.core.logging import logger
from app.repositories.contact_repository import ContactRepository, contact_repository
from app.repositories.user_repository import UserRepository, user_repository
from app.schemas.contact import (
    ActionSuccessResponse,
    ContactItemResponse,
    ContactListResponse,
    ContactRequestListResponse,
    ContactRequestResponse,
    SendContactRequest,
)
from app.schemas.user import UserPublicProfileResponse


class ContactService:
    """Manages connection requests, friendships, and contact rosters."""

    def __init__(
        self,
        contact_repo: ContactRepository = contact_repository,
        user_repo: UserRepository = user_repository,
    ):
        self.contact_repo = contact_repo
        self.user_repo = user_repo

    async def _resolve_user_id(self, payload: SendContactRequest) -> str:
        """Finds recipient user ID from direct recipient_id or identifier (username/email/phone)."""
        if payload.recipient_id:
            return payload.recipient_id.strip()

        if payload.identifier:
            query = payload.identifier.strip()
            # Try username
            user = await self.user_repo.get_by_username(query)
            if user:
                return user["id"]

            # Try email or phone search
            matches = await self.user_repo.search_users(query=query, limit=1)
            if matches:
                return matches[0]["id"]

        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Recipient user could not be found. Please check username, email, or ID.",
        )

    async def send_contact_request(
        self, sender_id: str, payload: SendContactRequest
    ) -> ContactRequestResponse:
        """Initiates a connection request from sender to recipient."""
        recipient_id = await self._resolve_user_id(payload)

        # 1. Prevent self-requests
        if sender_id == recipient_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You cannot send a connection request to yourself.",
            )

        # 2. Check if recipient exists and is active
        recipient = await self.user_repo.get_by_id(recipient_id)
        if not recipient or not recipient.get("is_active", True):
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recipient user does not exist or is inactive.",
            )

        # 3. Check if already connected
        if await self.contact_repo.is_contact(sender_id, recipient_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already connected with this user.",
            )

        # 4. Check for existing pending request in either direction
        existing = await self.contact_repo.find_existing_request(sender_id, recipient_id)
        if existing:
            if existing["sender_id"] == sender_id:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="You already have a pending connection request to this user.",
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="This user has already sent you a connection request. Please accept it.",
                )

        req_doc = await self.contact_repo.create_request(sender_id, recipient_id)
        sender = await self.user_repo.get_by_id(sender_id)

        # Dispatch real-time and persistent notification to recipient
        try:
            from shared.clients.service_client import get_notification_client
            notif_client = get_notification_client()
            sender_name = sender.get("name", "A user") if sender else "A user"
            sender_username = sender.get("username", "") if sender else ""
            desc = (
                f"{sender_name} (@{sender_username}) sent you a connection request."
                if sender_username
                else f"{sender_name} sent you a connection request."
            )
            await notif_client.post(
                "/api/v1/notifications",
                json_data={
                    "user_id": recipient_id,
                    "actor_id": sender_id,
                    "type": "request",
                    "category": "requests",
                    "title": "New Connection Request",
                    "description": desc,
                    "reference_id": req_doc["id"],
                    "link": "/app/requests",
                },
            )
        except Exception as notif_err:
            logger.warning(f"Failed to dispatch contact request notification: {notif_err}")

        logger.info(f"Connection request sent from {sender_id} to {recipient_id}")
        return ContactRequestResponse(
            id=req_doc["id"],
            sender_id=sender_id,
            recipient_id=recipient_id,
            status=req_doc["status"],
            sender=UserPublicProfileResponse(**sender) if sender else None,
            recipient=UserPublicProfileResponse(**recipient) if recipient else None,
            created_at=req_doc.get("created_at"),
            updated_at=req_doc.get("updated_at"),
        )

    async def list_requests(self, current_user_id: str) -> ContactRequestListResponse:
        """Returns all received and sent requests with populated user details."""
        raw_received = await self.contact_repo.get_received_requests(current_user_id)
        raw_sent = await self.contact_repo.get_sent_requests(current_user_id)

        # Helper to hydrate user objects
        async def hydrate_request(doc: Dict[str, Any]) -> ContactRequestResponse:
            sender = await self.user_repo.get_by_id(doc["sender_id"])
            recipient = await self.user_repo.get_by_id(doc["recipient_id"])
            return ContactRequestResponse(
                id=doc["id"],
                sender_id=doc["sender_id"],
                recipient_id=doc["recipient_id"],
                status=doc["status"],
                sender=UserPublicProfileResponse(**sender) if sender else None,
                recipient=UserPublicProfileResponse(**recipient) if recipient else None,
                created_at=doc.get("created_at"),
                updated_at=doc.get("updated_at"),
            )

        received = [await hydrate_request(r) for r in raw_received]
        sent = [await hydrate_request(s) for s in raw_sent]

        return ContactRequestListResponse(received=received, sent=sent)

    async def accept_request(
        self, current_user_id: str, request_id: str
    ) -> ActionSuccessResponse:
        """Accepts a received request and registers bidirectional contact links."""
        req = await self.contact_repo.get_request_by_id(request_id)
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connection request not found.",
            )

        # Ensure only the intended recipient can accept
        if req["recipient_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to accept this request.",
            )

        if req["status"] != "pending":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot accept request with status '{req['status']}'.",
            )

        # 1. Update status
        await self.contact_repo.update_request_status(request_id, "accepted")

        # 2. Insert bidirectional contact records
        await self.contact_repo.add_contact_pair(req["sender_id"], req["recipient_id"])

        # 3. Dispatch persistent notification to original requester
        try:
            from shared.clients.service_client import get_notification_client
            notif_client = get_notification_client()
            recipient = await self.user_repo.get_by_id(current_user_id)
            recipient_name = recipient.get("name", "A user") if recipient else "A user"
            await notif_client.post(
                "/api/v1/notifications",
                json_data={
                    "user_id": req["sender_id"],
                    "actor_id": current_user_id,
                    "type": "request",
                    "category": "requests",
                    "title": "Connection Request Accepted",
                    "description": f"{recipient_name} accepted your connection request.",
                    "reference_id": request_id,
                    "link": "/app/contacts",
                },
            )
        except Exception as notif_err:
            logger.warning(f"Failed to dispatch contact accepted notification: {notif_err}")

        logger.info(
            f"Accepted request {request_id}. Added contact link between {req['sender_id']} and {req['recipient_id']}"
        )
        return ActionSuccessResponse(message="Connection request accepted successfully.")

    async def reject_request(
        self, current_user_id: str, request_id: str
    ) -> ActionSuccessResponse:
        """Rejects a received connection request."""
        req = await self.contact_repo.get_request_by_id(request_id)
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connection request not found.",
            )

        if req["recipient_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not authorized to reject this request.",
            )

        await self.contact_repo.update_request_status(request_id, "rejected")
        logger.info(f"Rejected request {request_id} by user {current_user_id}")
        return ActionSuccessResponse(message="Connection request rejected.")

    async def cancel_request(
        self, current_user_id: str, request_id: str
    ) -> ActionSuccessResponse:
        """Cancels a sent connection request."""
        req = await self.contact_repo.get_request_by_id(request_id)
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Connection request not found.",
            )

        if req["sender_id"] != current_user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only cancel requests you initiated.",
            )

        await self.contact_repo.update_request_status(request_id, "cancelled")
        logger.info(f"Cancelled request {request_id} by sender {current_user_id}")
        return ActionSuccessResponse(message="Connection request cancelled.")

    async def get_contacts(self, current_user_id: str) -> ContactListResponse:
        """Returns the authenticated user's contact roster with populated public profiles."""
        records = await self.contact_repo.get_contacts_for_user(current_user_id)

        items: List[ContactItemResponse] = []
        for rec in records:
            contact_user = await self.user_repo.get_by_id(rec["contact_id"])
            if contact_user and contact_user.get("is_active", True):
                items.append(
                    ContactItemResponse(
                        id=rec["id"],
                        contact_id=rec["contact_id"],
                        user=UserPublicProfileResponse(**contact_user),
                        created_at=rec.get("created_at"),
                    )
                )

        return ContactListResponse(items=items, total=len(items))

    async def delete_contact(
        self, current_user_id: str, contact_id: str
    ) -> ActionSuccessResponse:
        """Removes a user from the contact roster (removes bidirectional friendship)."""
        await self.contact_repo.remove_contact_pair(current_user_id, contact_id)
        logger.info(f"Contact removed between {current_user_id} and {contact_id}")
        return ActionSuccessResponse(message="Contact removed from roster.")


contact_service = ContactService()
