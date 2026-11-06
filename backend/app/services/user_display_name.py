ANONYMOUS_DISPLAY_NAME = "Player"


def display_name_for_username(username: str | None) -> str:
    if username:
        return username
    return ANONYMOUS_DISPLAY_NAME
