from app.services.sudoku.technique import TECHNIQUE_ORDER, Technique
from app.services.sudoku.technique_registry import TECHNIQUES


def test_registry_keys_are_every_technique():
    assert set(TECHNIQUES) == set(Technique)


def test_technique_order_has_no_duplicates():
    assert len(TECHNIQUE_ORDER) == len(set(TECHNIQUE_ORDER))


def test_only_singles_have_no_eliminator():
    placements = {technique for technique, spec in TECHNIQUES.items() if spec.eliminate is None}
    assert placements == {Technique.NAKED_SINGLE, Technique.HIDDEN_SINGLE}
