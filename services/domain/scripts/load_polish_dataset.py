#!/usr/bin/env python3
"""Normalize the UCI Polish companies bankruptcy dataset into the schema.

The dataset is 43,405 company-year observations of 64 financial *ratios* plus a
bankruptcy label. It is a reference set, not a ledger: it carries no dates, no
individual cash movements, no counterparties and no company identity. What it
does carry is an absolute scale, because `Attr29` is the base-10 logarithm of
total assets, which lets every ratio be turned back into an amount.

What each target table gets, and how much of it is observed:

  companies          one row per observation. The dataset publishes no keys, so
                     rows are never joined across files: two rows may be the
                     same firm and there is no way to tell.
  company_snapshots  two of the seven coverage variables are real
                     (`average_collection_days` from Attr44, and the cash
                     balance derived from Attr40 x Attr51 x 10^Attr29). The
                     other five are absent from the source and stay NULL, which
                     is what forces these companies to abstain -- the correct
                     outcome, not a defect.
  movements          DERIVED, and every row says so: `provenance` is
                     'hypothetical' and `source` is 'rule'. The amounts come
                     from the ratios; THE DATES DO NOT EXIST IN THE SOURCE and
                     are laid out on a synthetic calendar from the cut-off.
                     Never read these as observed facts.
  outcome_events     the bankruptcy label, the one genuinely observed event.

Usage, from services/domain:

    python3 scripts/load_polish_dataset.py --source ~/Downloads/polish+companies+bankruptcy+data
    python3 scripts/load_polish_dataset.py --source ... --limit 500   # a sample

It writes CSV files for `\\copy`; it never connects to a database itself.
"""

from __future__ import annotations

import argparse
import collections
import csv
import datetime as dt
import hashlib
import math
import pathlib
import sys

# --- Constants that are decisions, not data -------------------------------

# One documented rate for the whole set. The observations span 2000-2013 and
# this is a 2026 rate, so every converted amount carries that distortion; it is
# recorded in `companies.name` provenance and in docs/data-model.md §6.
PLN_TO_MXN = 4.5494

# Polish financial statements in this dataset are stated in thousands.
THOUSANDS = 1_000

# The cut-off every snapshot is dated at, matching DOMAIN_CUTOFF_DATE.
CUTOFF = dt.date(2026, 9, 12)

# The forecast horizon each file carries: 1year predicts bankruptcy 5 years
# ahead, 5year predicts it 1 year ahead (UCI dataset description).
HORIZON_YEARS = {"1year": 5, "2year": 4, "3year": 3, "4year": 2, "5year": 1}

# The tails of this dataset carry artefacts: Attr44 reaches 22,584,000 "days"
# of collection, and Attr29 implies a firm with 2.4 trillion PLN of assets. The
# bulk is sound -- median total assets are 13.6M PLN, the 99th percentile
# 1,024M PLN -- so the bounds below reject the impossible rather than clamping
# it, and every rejection is counted and reported. A wrong number is worse than
# an absent one (docs/data-model.md §1).
#
# A collection cycle longer than a year is not a collection cycle.
MAX_CYCLE_DAYS = 365
# Total assets above this are a data artefact, not a Polish SME: the 99.9th
# percentile of the set is 3.2M thousands of PLN.
MAX_TOTAL_ASSETS_THOUSANDS = 10_000_000

# The window every derived stream spans, matching the engine's default horizon
# so the calendar covers exactly what an analysis reads.
HORIZON_DAYS = 180

# Crockford base32, as in internal/movements/domain/ulid.go.
CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def ulid(when: dt.datetime, key: str, seed: int) -> str:
    """A 26-character ULID: 48 bits of timestamp, 80 bits derived from `key`.

    The suffix is a hash of the key rather than a draw from a shared stream, so
    an observation keeps its identifier no matter what else the run produces.
    An earlier version drew from one sequential generator, which meant changing
    how many movements a company yields silently renumbered every company after
    it -- and a reload then orphaned the rows already stored.
    """
    ms = int(when.timestamp() * 1000)
    out = [CROCKFORD[(ms >> (5 * (9 - i))) & 31] for i in range(10)]
    digest = hashlib.blake2b(f"{seed}:{key}".encode(), digest_size=10).digest()
    bits = int.from_bytes(digest, "big")
    for i in range(16):
        out.append(CROCKFORD[(bits >> (5 * (15 - i))) & 31])
    return "".join(out)


def parse_arff(path: pathlib.Path) -> list[list[str]]:
    """Reads the @data section. Missing values are '?' in ARFF."""
    rows: list[list[str]] = []
    started = False
    with path.open(encoding="utf-8", errors="replace") as handle:
        for line in handle:
            stripped = line.strip()
            if not started:
                if stripped.lower().startswith("@data"):
                    started = True
                continue
            if stripped:
                rows.append(stripped.split(","))
    return rows


def value(row: list[str], attr: int) -> float | None:
    """Attribute `attr` is 1-based, as the dataset names it (Attr1..Attr64)."""
    raw = row[attr - 1]
    if raw == "?":
        return None
    try:
        parsed = float(raw)
    except ValueError:
        return None
    return parsed if math.isfinite(parsed) else None


def to_cents(thousands_of_pln: float) -> int:
    """Thousands of PLN to an integer count of MXN cents."""
    return round(thousands_of_pln * THOUSANDS * PLN_TO_MXN * 100)


class Observation:
    """One row of the dataset, with its ratios resolved into amounts.

    Every attribute reference below is the UCI description, verified against
    the data: 10^Attr29 is total assets in the same unit as Attr55, which is
    self-consistent with Attr3 (working capital / total assets) in 97.9% of
    rows.
    """

    def __init__(self, row: list[str]) -> None:
        self.bankrupt = row[-1].strip() == "1"

        log_assets = value(row, 29)
        self.total_assets = 10**log_assets if log_assets is not None else None

        self.collection_days = value(row, 44)  # (receivables * 365) / sales
        self.inventory_days = value(row, 20)  # (inventory * 365) / sales
        self.payable_days = value(row, 52)  # (short-term liab * 365) / COGS

        ta = self.total_assets
        self.sales = self._scaled(row, 9, ta)  # sales / total assets
        self.short_term_liabilities = self._scaled(row, 51, ta)
        self.total_liabilities = self._scaled(row, 2, ta)
        self.equity = self._scaled(row, 10, ta)

        # Attr40 = (current assets - inventory - receivables) / short-term
        # liabilities, which is the cash-and-equivalents ratio.
        cash_ratio = value(row, 40)
        self.cash = (
            cash_ratio * self.short_term_liabilities
            if cash_ratio is not None and self.short_term_liabilities is not None
            else None
        )

        self.receivables = self._from_days(self.collection_days, self.sales)
        self.inventory = self._from_days(self.inventory_days, self.sales)

        # Attr33 = operating expenses / short-term liabilities.
        opex_ratio = value(row, 33)
        self.operating_expenses = (
            opex_ratio * self.short_term_liabilities
            if opex_ratio is not None and self.short_term_liabilities is not None
            else None
        )

        # Attr58 = total costs / total sales. This is the ratio the calendar is
        # anchored on, because it is the one that decides whether cash comes in
        # or goes out, and it is credible: its median is 0.939 and 87% of the
        # set spends less than it sells.
        #
        # The cost of sales implied by Attr52 is NOT used. Read as
        # `short-term liabilities * 365 / Attr52` it comes to 352 times sales at
        # the median, which no business does; whatever that ratio encodes, it is
        # not an annual cost this loader can reconstruct.
        cost_ratio = value(row, 58)
        self.total_costs = (
            cost_ratio * self.sales
            if cost_ratio is not None and 0 < cost_ratio < 10 and self.sales is not None
            else None
        )

        # Operating expenses (Attr33) and the cost of sales (Attr52) come from
        # different ratios and do not reconcile in this dataset: their
        # difference is negative for most rows, so overheads are not separable
        # here and no stream is derived for them. Saying so is better than
        # emitting a figure the data does not support.

    @staticmethod
    def _scaled(row: list[str], attr: int, total_assets: float | None) -> float | None:
        ratio = value(row, attr)
        if ratio is None or total_assets is None:
            return None
        return ratio * total_assets

    @staticmethod
    def _from_days(days: float | None, sales: float | None) -> float | None:
        if days is None or sales is None:
            return None
        return days * sales / 365

    def rejection(self) -> str | None:
        """Why this row cannot be turned into money, or None if it can."""
        if self.total_assets is None or self.total_assets <= 0:
            return "sin escala (Attr29 ausente o no positivo)"
        if self.total_assets > MAX_TOTAL_ASSETS_THOUSANDS:
            return "activos totales fuera de rango creíble"
        if self.sales is None or self.sales <= 0:
            return "sin ventas (Attr9 ausente o no positivo)"
        # A few rows imply a negative cash balance, which is not a balance. They
        # are excluded rather than clamped to zero: zero would be a confident
        # lie about an unknown (docs/data-model.md §1).
        if self.cash is not None and self.cash < 0:
            return "saldo de efectivo negativo"
        return None


# --- The synthetic cash calendar ------------------------------------------
#
# Everything below INVENTS dates. The dataset has none: it reports annual
# ratios, not transactions. What is derived from the data is each amount and
# each interval; where they land on a calendar is a convention, which is why
# every row is written with provenance 'hypothetical' and source 'rule'.

# node, direction, whether the amount scales with sales, and which stochastic
# factor the engine should apply (contracts/engine-request.schema.json).
def movements_for(obs: Observation, cutoff: dt.date) -> list[tuple]:
    """Derives one quarter of a cash calendar from the ratios.

    Returns (node, direction, day offset, amount in thousands, shift, scale).
    A None amount, a non-positive one, or an interval outside a year is
    dropped rather than substituted: an absent figure stays absent.

    The streams are deliberately disjoint. An earlier version paid the
    short-term liabilities balance as `supplier`, the inventory balance as
    `materials` and the whole of operating expenses as `tax`, which charged the
    same money three times and put every company in crisis regardless of its
    ratios. What a company spends is the cost of sales plus the overheads on top
    of it, and nothing else here may overlap with either.
    """
    out: list[tuple] = []

    def add(node: str, direction: str, day: int, amount: float | None,
            shift: str, scale: str) -> None:
        if amount is None or amount <= 0 or not math.isfinite(amount):
            return
        if not 0 <= day <= HORIZON_DAYS:
            return
        out.append((node, direction, day, amount, shift, scale))

    def cycle_stream(node: str, direction: str, days: float | None,
                     per_cycle: float | None, shift: str, scale: str) -> None:
        """Repeats a movement every `days` for the whole horizon.

        Every stream spans the same window. An earlier version emitted a fixed
        three occurrences of each, so a 10-day payables cycle covered 30 days
        while a 71-day collection cycle covered 213 -- the streams were then
        measuring different periods and could not be weighed against each other.
        """
        if days is None or not 0 < days <= MAX_CYCLE_DAYS:
            return
        step = max(1, round(days))
        for day in range(step, HORIZON_DAYS + 1, step):
            add(node, direction, day, per_cycle, shift, scale)

    # Receivables are collected once per collection cycle. In a steady state the
    # amount collected per cycle is the receivables balance itself.
    cycle_stream("collection", "in", obs.collection_days, obs.receivables,
                 "collection", "sales")

    # Everything the business spends, paid monthly: one stream, so nothing can
    # be charged twice. Over the horizon it annualises to Attr58 x sales, which
    # is what makes the calendar's sign meaningful -- a company that spends less
    # than it sells accumulates cash here, and one that spends more does not.
    if obs.total_costs is not None and obs.total_costs > 0:
        for day in range(30, HORIZON_DAYS + 1, 30):
            add("supplier", "out", day, obs.total_costs * 30 / 365, "none", "cost")

    # Long-term debt is serviced monthly over a conventional five years.
    if obs.total_liabilities is not None and obs.short_term_liabilities is not None:
        long_term = obs.total_liabilities - obs.short_term_liabilities
        if long_term > 0:
            for day in range(30, HORIZON_DAYS + 1, 30):
                add("debt", "out", day, long_term / 60, "none", "none")

    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=pathlib.Path,
                        help="directory holding 1year.arff .. 5year.arff")
    parser.add_argument("--out", type=pathlib.Path, default=pathlib.Path("build/polish"),
                        help="where the CSV files are written")
    parser.add_argument("--limit", type=int, default=0,
                        help="load at most this many observations per file (0 = all)")
    parser.add_argument("--seed", type=int, default=42,
                        help="salt for identifier derivation; the same seed and the same\n"
                             "source always produce the same identifiers")
    args = parser.parse_args()

    files = sorted(args.source.glob("*year.arff"))
    if not files:
        print(f"no *.arff files under {args.source}", file=sys.stderr)
        return 1

    args.out.mkdir(parents=True, exist_ok=True)
    stamp = dt.datetime(2026, 9, 12, tzinfo=dt.timezone.utc)

    counts = {"companies": 0, "snapshots": 0, "movements": 0, "outcomes": 0, "skipped": 0}
    rejected: collections.Counter[str] = collections.Counter()
    unbounded_cycle = 0

    with (
        (args.out / "companies.csv").open("w", newline="") as f_companies,
        (args.out / "company_snapshots.csv").open("w", newline="") as f_snapshots,
        (args.out / "movements.csv").open("w", newline="") as f_movements,
        (args.out / "outcome_events.csv").open("w", newline="") as f_outcomes,
    ):
        companies = csv.writer(f_companies)
        snapshots = csv.writer(f_snapshots)
        movements = csv.writer(f_movements)
        outcomes = csv.writer(f_outcomes)

        companies.writerow(["company_id", "name", "vertical", "currency"])
        snapshots.writerow([
            "snapshot_id", "company_id", "cutoff_date", "dataset",
            "opening_balance_cents", "payroll_cents", "main_customer_concentration",
            "contracted_term_days", "average_collection_days",
            "known_variables", "total_variables",
        ])
        movements.writerow([
            "movement_id", "company_id", "node", "direction", "due_date",
            "amount_cents", "settled_cents", "status", "known_at", "source",
            "source_ref", "shift", "scale", "exposure", "provenance", "description",
        ])
        outcomes.writerow([
            "event_id", "company_id", "kind", "occurred_on", "amount_cents", "evidence",
        ])

        for path in files:
            horizon = HORIZON_YEARS.get(path.stem, 0)
            rows = parse_arff(path)
            if args.limit:
                rows = rows[: args.limit]

            for index, row in enumerate(rows):
                obs = Observation(row)
                why = obs.rejection()
                if why is not None:
                    rejected[why] += 1
                    counts["skipped"] += 1
                    continue

                label = f"PL-{path.stem}-{index:05d}"
                company_id = ulid(stamp, f"company:{label}", args.seed)
                companies.writerow([company_id, label, "reference_dataset", "MXN"])
                counts["companies"] += 1

                # Two of the seven coverage variables are observed; the rest are
                # absent from the source and stay empty, which is NULL on copy.
                # Beyond a year the figure is an artefact, so the variable is
                # left unknown rather than recorded wrong. That costs coverage,
                # which is exactly what it should cost.
                if obs.collection_days is not None and obs.collection_days > MAX_CYCLE_DAYS:
                    unbounded_cycle += 1
                collection_days = (
                    round(obs.collection_days)
                    if obs.collection_days is not None
                    and 0 <= obs.collection_days <= MAX_CYCLE_DAYS
                    else ""
                )
                known = 1 + (1 if collection_days != "" else 0)
                snapshots.writerow([
                    ulid(stamp, f"snapshot:{label}", args.seed), company_id,
                    CUTOFF.isoformat(), "uci-polish-bankruptcy",
                    to_cents(obs.cash) if obs.cash is not None else "",
                    "", "", "", collection_days, known, 7,
                ])
                counts["snapshots"] += 1

                for seq, (node, direction, day, amount, shift, scale) in enumerate(
                    movements_for(obs, CUTOFF)
                ):
                    due = CUTOFF + dt.timedelta(days=day)
                    movements.writerow([
                        ulid(stamp, f"movement:{label}:{seq}", args.seed),
                        company_id, node, direction, due.isoformat(),
                        to_cents(amount), 0, "expected", CUTOFF.isoformat(), "rule",
                        "", shift, scale, "none", "hypothetical",
                        "Derivado de ratios; fecha sintética",
                    ])
                    counts["movements"] += 1

                if obs.bankrupt:
                    # The one observed event. The date is the horizon the file
                    # declares, counted from the cut-off.
                    occurred = CUTOFF.replace(year=CUTOFF.year + horizon) if horizon else CUTOFF
                    outcomes.writerow([
                        ulid(stamp, f"outcome:{label}", args.seed), company_id,
                        "bankruptcy", occurred.isoformat(), "",
                        f"UCI Polish companies bankruptcy data, {path.stem}, "
                        f"quiebra dentro de {horizon} año(s)",
                    ])
                    counts["outcomes"] += 1

    print(f"escrito en {args.out}/")
    for name, total in counts.items():
        print(f"  {name:12} {total:>9,}")
    if rejected:
        print("\n  filas descartadas, por motivo:")
        for why, total in rejected.most_common():
            print(f"    {total:>7,}  {why}")
    if unbounded_cycle:
        print(f"\n  {unbounded_cycle:,} filas con días de cobro > {MAX_CYCLE_DAYS}: "
              "la variable queda desconocida, no corregida")
    print(f"\n  tipo de cambio aplicado: 1 PLN = {PLN_TO_MXN} MXN")
    print("  los movimientos llevan provenance='hypothetical': sus fechas no existen en la fuente")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
