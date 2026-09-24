from django.urls import path

from .views import TicketDetail, TicketList

urlpatterns = [
    path("tickets/", TicketList.as_view(), name="ticket-list"),
    path("tickets/<str:key>/", TicketDetail.as_view(), name="ticket-detail"),
]
