from sqlalchemy.engine import make_url


def is_test_database_url(url: str) -> bool:
    database_name = make_url(url).database
    return database_name is not None and database_name.endswith("_test")
