import re

from django.http import Http404
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema, extend_schema_view
from rest_framework import generics

from access import policies
from core.pagination import CursorPage

from .serializers import TicketDetailSerializer, TicketSerializer

KEY_RE = re.compile(r"^([A-Z]{2,10})-([1-9][0-9]*)$")


class TicketList(generics.ListAPIView):
    serializer_class = TicketSerializer
    pagination_class = CursorPage

    def get_queryset(self):
        return policies.accessible_tickets(self.request.user).select_related("organization")


@extend_schema_view(
    get=extend_schema(parameters=[OpenApiParameter("key", str, OpenApiParameter.PATH, description="e.g. ACME-42")])
)
class TicketDetail(generics.RetrieveAPIView):
    serializer_class = TicketDetailSerializer

    def get_object(self):
        match = KEY_RE.match(self.kwargs["key"].upper())
        if not match:
            raise Http404
        org_key, number = match.groups()
        scoped = policies.accessible_tickets(self.request.user).select_related("organization")
        return get_object_or_404(scoped, organization__key=org_key, number=int(number))
