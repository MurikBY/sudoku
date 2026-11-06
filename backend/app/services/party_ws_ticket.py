import secrets
import time
import uuid
from dataclasses import dataclass

TICKET_TTL_SECONDS = 30


class PartyWsTicketRejected(Exception):
    pass


@dataclass(frozen=True)
class _PartyWsTicket:
    party_id: uuid.UUID
    user_id: int
    expires_at: float


def _now() -> float:
    return time.monotonic()


class PartyWsTicketStore:
    def __init__(self) -> None:
        self._tickets: dict[str, _PartyWsTicket] = {}

    def issue(self, party_id: uuid.UUID, user_id: int) -> str:
        now = _now()
        self._drop_expired(now)
        token = secrets.token_urlsafe(32)
        self._tickets[token] = _PartyWsTicket(
            party_id=party_id,
            user_id=user_id,
            expires_at=now + TICKET_TTL_SECONDS,
        )
        return token

    def consume(self, token: str, party_id: uuid.UUID) -> int:
        ticket = self._tickets.pop(token, None)
        if ticket is None:
            raise PartyWsTicketRejected("party ws ticket missing")
        if _now() >= ticket.expires_at:
            raise PartyWsTicketRejected("party ws ticket expired")
        if ticket.party_id != party_id:
            raise PartyWsTicketRejected("party ws ticket party mismatch")
        return ticket.user_id

    def _drop_expired(self, now: float) -> None:
        expired = [token for token, ticket in self._tickets.items() if now >= ticket.expires_at]
        for token in expired:
            del self._tickets[token]


party_ws_tickets = PartyWsTicketStore()
