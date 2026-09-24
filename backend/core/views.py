from django.db import connection
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response


@extend_schema(responses={200: inline_serializer("Health", {"status": serializers.CharField()})})
@api_view(["GET"])
@authentication_classes([])
@permission_classes([AllowAny])
def health(request):
    connection.ensure_connection()
    return Response({"status": "ok"})
