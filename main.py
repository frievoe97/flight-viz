"""Command-line entry point for the flightviz tooling."""

from __future__ import annotations

import argparse
import logging

from flightviz import main as run_pipeline


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Download and export FlightAware tracklogs.")
    parser.add_argument(
        "--csv",
        dest="csv_path",
        default=None,
        help="Path to the flights CSV. Defaults to the path defined in flightviz.config.",
    )
    return parser


def main() -> None:
    args = build_parser().parse_args()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s - %(message)s",
    )
    run_pipeline(args.csv_path)


if __name__ == "__main__":
    main()
