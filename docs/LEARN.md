# Learn

Learn is the technique curriculum inside the Mini App. The sections, the articles, and practice are written in the same language as the Guide: English, Ukrainian, or Belarusian (`sudoku.infoGuide.lang` is `en`, `ua`, or `by`). The names of the solving techniques stay English.

## Index

A player meets the sections in this order:

1. Pencil marks
2. Naked single
3. Hidden single
4. Naked pair
5. Hidden pair
6. Pointing pair
7. Box/line reduction
8. X-Wing
9. Swordfish
10. XY-Wing
11. XYZ-Wing

Pencil marks come first on the screen. The solver does not treat them as a solving technique, so its list starts at naked single and ends at XYZ-Wing. Saved progress follows that list and puts pencil marks last. The progress response comes back in that saved order. The screen does not follow it: pencil marks stay first.

## Pools

Each entry has a pool of nine positions (`LESSON_POOL_SIZE`). Loading a pool rejects any other size, and it rejects a pool that does not have exactly one taught position. The other eight are practice.

A lesson game copies the assists currently saved in Settings. It sets `is_lesson` and does not set `party_id`. It is not scored (`SCORED_GAME` excludes lessons) and `build_completion_recap` skips it, so it does not enter the clean-best rating.

Pencil and the easy techniques are stored as Easy, the medium techniques as Medium, and the rest as Hard.

## Practice

"Practice this" on an article calls `create_lesson_game` with the practice role and no excluded id. The position is `secrets.choice` over the whole pool, so the taught position can come up.

"Try another puzzle of this lesson" sends `exclude_position_id` equal to the current game's `lesson_position_id`. That id is filtered out before the choice. The request omits the field when it is undefined. If the filter leaves no positions, the call raises `LessonPracticeUnavailable`.

## Done

The success card follows `lesson_objective_met` on the game response. The mapper sets that flag from `lesson_runtime`, which does not look at hints. The card stays up during play and after the grid is complete, until the player chooses one of the actions below.

The objective itself:

- Pencil: the issue cell's notes include every required digit.
- Naked single: one of the lesson's placements is on the grid.
- Hidden single: the step's digit is in its focus cell.
- Elimination techniques: a still-empty cell must lose every candidate the step removes. A cell filled with a candidate the step removes does not meet the objective. A cell filled with another digit does.

"Continue solving this puzzle" hides the card and stays on the same game. If that game is already complete, the completion card shows instead. "Try another" starts a new practice game as above. "Return to Learning" leaves the game.

`record_if_objective_met` writes a `LessonProgress` row only when the game is a lesson, `hints_count` is 0, and the objective is met. A repeated completion of the same position does not insert a second row. A hint therefore blocks the progress count and still leaves the success card, because the card reads the objective flag and not the progress row. Undo deletes that row when it changes the objective from met to unmet and this game wrote the row: `completed_at` is not earlier than the game's `started_at`. A completion from an earlier game of the same position stays, because a repeated insert does not move `completed_at`. The same insert runs again when undo restores a met objective on a lesson with no hints.
