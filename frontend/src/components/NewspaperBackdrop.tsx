import type { ReactNode } from "react";

const COL_A = [
  "City council delayed the quay vote until Thursday after a late amendment on ferry fares. Merchants along the embankment asked for clearer weekend market rules after dusk.",
  "Rain returned overnight and left the tram lines slick from the depot to the north square. Morning service ran three minutes behind on the river loop.",
  "A letter to the editor praised Saturday’s crossword and asked again for a harder sudoku on Mondays.",
  "The mayor’s office called the pause temporary and promised a public hearing before any final tally of the quay plan.",
];

const COL_B = [
  "Harbour traffic was light before noon. Two freighters waited outside the mole while a pilot boat crossed the channel in a thin mist.",
  "On the stone quay, stevedores stacked coffee and newsprint under tarpaulins. The mill upriver sent word that damp weather had slowed a short run of ink.",
  "Printers spoke of paper costs climbing by fractions and of compositors working late under gaslight.",
  "Conductors warned passengers to mind the step where the river loop meets the north square platform.",
];

const COL_C = [
  "In the markets, wheat held near twelve and a quarter. Coal eased a shade. Coffee was unchanged through the morning session.",
  "The puzzle desk notes that pencils are preferred to ink, and that corrections belong in the margin–never across a finished digit.",
  "Friends of the late typesetter gathered quietly. Notices asked that flowers be omitted.",
  "Readers who clipped yesterday’s ferry timetable are advised that the last boat still leaves at dusk, rain or shine.",
];

const COL_D = [
  "Elsewhere on the waterfront the order of stalls remains unsettled. Water and light after dusk are still wanting, say the merchants who wrote to the desk.",
  "A small run of newsprint arrived late from the mill. The night shift waited under gaslight with half-set pages on the stone.",
];

const COL_E = [
  "City notes: the tram depot will oil the switches before Friday. Schoolchildren again filled the gallery at the morning crossword lecture.",
  "From correspondence: one reader prefers ink; the desk respectfully disagrees, and keeps a pot of pencils by the copy spike.",
];

const COL_F = [
  "Shipping list – inward: two freighters, one pilot. Outward: empty holds and a thin mist over the mole until noon.",
  "The autumn editions will keep the puzzle on page twelve. Corrections, as ever, in the margin only.",
];

const MARKET_PRICES = [
  { name: "Wheat", price: "12¼" },
  { name: "Coal", price: "8¾" },
  { name: "Paper", price: "6½" },
  { name: "Ink", price: "3⅛" },
] as const;

function NewsColumn({ paragraphs, children }: { paragraphs: string[]; children?: ReactNode }) {
  return (
    <div className="np-column">
      {paragraphs.map((paragraph) => (
        <p key={paragraph.slice(0, 40)}>{paragraph}</p>
      ))}
      {children}
    </div>
  );
}

function NewsMidBand() {
  return (
    <div className="np-mid">
      <hr className="np-hairline" />
      <div className="np-lower">
        <div className="np-lower-block">
          <p className="np-kicker">Weather</p>
          <p>
            Mist in the morning, clearing by afternoon. Wind NW. Mild for the season. Last boat at
            dusk.
          </p>
        </div>
        <div className="np-lower-block np-markets">
          <p className="np-kicker">Markets</p>
          <ul>
            {MARKET_PRICES.map((market) => (
              <li key={market.name}>
                <span>{market.name}</span>
                <span>{market.price}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="np-lower-block">
          <p className="np-kicker">Notice</p>
          <p className="np-italic">
            Wanted – night compositor. Apply rear door, ask for the stone. Steady work through
            autumn.
          </p>
        </div>
      </div>
      <hr className="np-hairline" />
    </div>
  );
}

export function NewspaperBackdrop() {
  return (
    <div className="newspaper-backdrop" aria-hidden="true">
      <div className="newspaper-page">
        <header className="np-top">
          <p className="np-folio">Vol. I · No. 24 · Morning edition · Page 12</p>
          <hr className="np-hairline" />
          <p className="np-strap">
            Merchants press for weekend market rules as council tables the quay plan until Thursday.
          </p>
        </header>

        <div className="np-columns np-columns-main">
          <NewsColumn paragraphs={COL_A} />
          <NewsColumn paragraphs={COL_B} />
          <NewsColumn paragraphs={COL_C}>
            <p className="np-jump">Continued on page 4</p>
          </NewsColumn>
        </div>

        <NewsMidBand />

        <div className="np-columns np-columns-foot">
          <NewsColumn paragraphs={COL_D} />
          <NewsColumn paragraphs={COL_E} />
          <NewsColumn paragraphs={COL_F} />
        </div>
      </div>
    </div>
  );
}
