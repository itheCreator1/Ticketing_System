from rest_framework.authentication import SessionAuthentication


class SessionAuthentication401(SessionAuthentication):
    """DRF answers 403 when the first authenticator has no WWW-Authenticate header.
    Returning one makes unauthenticated requests 401, as the API conventions require."""

    def authenticate_header(self, request) -> str:
        return 'Session realm="api"'
