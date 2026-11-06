from app.models.enums import Difficulty
from app.services.archived_rating_totals import add_archived_rating_totals
from tests.fixtures import TEST_ARCHIVE


def test_add_archived_rating_totals_combines_live_easy_with_archive():
    archive = TEST_ARCHIVE[Difficulty.easy]
    started, completed, clean, avg = add_archived_rating_totals(
        games_started=5,
        games_completed=4,
        clean_wins=4,
        clean_elapsed_sum=560,
        archive=archive,
    )
    assert started == 13
    assert completed == 9
    assert clean == 7
    assert avg == 81


def test_add_archived_rating_totals_uses_archive_when_live_is_empty():
    archive = TEST_ARCHIVE[Difficulty.hard]
    started, completed, clean, avg = add_archived_rating_totals(
        games_started=0,
        games_completed=0,
        clean_wins=0,
        clean_elapsed_sum=0,
        archive=archive,
    )
    assert started == 4
    assert completed == 3
    assert clean == 2
    assert avg == 5
