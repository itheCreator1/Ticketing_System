from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView

from core.views import health

urlpatterns = [
    path("api/v1/health/", health, name="health"),
    path("api/v1/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/v1/", include("tickets.urls")),
]
