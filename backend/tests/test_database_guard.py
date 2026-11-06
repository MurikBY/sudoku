from tests.database_guard import is_test_database_url


def test_rejects_database_not_ending_in_test() -> None:
    url = "postgresql+asyncpg://sudoku:change_me@localhost:5434/sudoku"
    assert is_test_database_url(url) is False


def test_accepts_database_ending_in_test() -> None:
    url = "postgresql+asyncpg://sudoku:test@localhost:5432/sudoku_test"
    assert is_test_database_url(url) is True


def test_rejects_url_without_database() -> None:
    url = "postgresql+asyncpg://sudoku:test@localhost:5432"
    assert is_test_database_url(url) is False
