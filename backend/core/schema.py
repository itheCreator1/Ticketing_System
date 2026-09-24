from drf_spectacular.authentication import SessionScheme


class SessionAuthentication401Scheme(SessionScheme):
    """Documents SessionAuthentication401 as the standard session-cookie scheme."""

    target_class = "core.auth.SessionAuthentication401"
    priority = 1
