from drf_spectacular.utils import extend_schema_field
from rest_framework import serializers

from access import policies

from .models import Event, Ticket


class EventSerializer(serializers.ModelSerializer):
    class Meta:
        model = Event
        fields = ["id", "visibility", "body", "created_at"]


class TicketSerializer(serializers.ModelSerializer):
    key = serializers.CharField(read_only=True)
    organization = serializers.CharField(source="organization.key", read_only=True)

    class Meta:
        model = Ticket
        fields = ["key", "subject", "status", "organization", "created_at"]


class TicketDetailSerializer(TicketSerializer):
    events = serializers.SerializerMethodField()

    class Meta(TicketSerializer.Meta):
        fields = [*TicketSerializer.Meta.fields, "events"]

    @extend_schema_field(EventSerializer(many=True))
    def get_events(self, ticket: Ticket):
        return EventSerializer(policies.visible_events(self.context["request"].user, ticket), many=True).data
