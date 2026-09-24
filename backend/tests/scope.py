"""The scope matrix. VISIBLE is written by hand on purpose — never derive it from the code under test."""

from dataclasses import dataclass

from .world import INTERNAL_SENTINEL

VISIBLE: dict[str, set[str]] = {
    "sam": {"ACME-1", "ACME-2", "GLOBX-1"},
    "maria": {"ACME-1", "ACME-2"},
    "nikos": {"ACME-1"},
    "otto": set(),
    "alice": {"ACME-1"},
    "bob": {"ACME-2"},
    "carol": {"ACME-1", "ACME-2"},
    "gina": {"GLOBX-1"},
}
ACTORS = list(VISIBLE)
TICKETS = ["ACME-1", "ACME-2", "GLOBX-1"]
STAFF = {"sam", "maria", "nikos", "otto"}


@dataclass(frozen=True)
class ScopeCase:
    actor: str
    ticket: str

    @property
    def visible(self) -> bool:
        return self.ticket in VISIBLE[self.actor]

    @property
    def staff(self) -> bool:
        return self.actor in STAFF


SCOPE_CASES = [ScopeCase(a, t) for a in ACTORS for t in TICKETS]


def assert_no_internal(response) -> None:
    """Fail if any internal content leaked. Pair every use with a staff positive control."""
    assert INTERNAL_SENTINEL not in response.content.decode(), "internal content leaked"
