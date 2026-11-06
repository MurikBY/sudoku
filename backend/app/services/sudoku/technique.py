from enum import StrEnum


class Technique(StrEnum):
    NAKED_SINGLE = "naked_single"
    HIDDEN_SINGLE = "hidden_single"
    NAKED_PAIR = "naked_pair"
    HIDDEN_PAIR = "hidden_pair"
    POINTING_PAIR = "pointing_pair"
    BOX_LINE_REDUCTION = "box_line_reduction"
    X_WING = "x_wing"
    SWORDFISH = "swordfish"
    XY_WING = "xy_wing"
    XYZ_WING = "xyz_wing"


TECHNIQUE_ORDER: tuple[Technique, ...] = (
    Technique.NAKED_SINGLE,
    Technique.HIDDEN_SINGLE,
    Technique.NAKED_PAIR,
    Technique.HIDDEN_PAIR,
    Technique.POINTING_PAIR,
    Technique.BOX_LINE_REDUCTION,
    Technique.X_WING,
    Technique.SWORDFISH,
    Technique.XY_WING,
    Technique.XYZ_WING,
)

EASY_TECHNIQUES = frozenset({Technique.NAKED_SINGLE, Technique.HIDDEN_SINGLE})
MEDIUM_TECHNIQUES = EASY_TECHNIQUES | frozenset(
    {
        Technique.NAKED_PAIR,
        Technique.HIDDEN_PAIR,
        Technique.POINTING_PAIR,
        Technique.BOX_LINE_REDUCTION,
    }
)
HARD_TECHNIQUES = frozenset(
    {
        Technique.X_WING,
        Technique.SWORDFISH,
        Technique.XY_WING,
        Technique.XYZ_WING,
    }
)
ALL_TECHNIQUES = MEDIUM_TECHNIQUES | HARD_TECHNIQUES
DIGIT_TECHNIQUES = ALL_TECHNIQUES - frozenset({Technique.NAKED_PAIR, Technique.HIDDEN_PAIR})

_TECHNIQUE_RANK = {technique: rank for rank, technique in enumerate(TECHNIQUE_ORDER, start=1)}


def hardest_of(
    current: Technique | None,
    candidate: Technique,
) -> Technique:
    if current is None:
        return candidate
    if _TECHNIQUE_RANK[candidate] > _TECHNIQUE_RANK[current]:
        return candidate
    return current
