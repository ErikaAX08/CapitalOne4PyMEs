"""Structural fragility engine: cash calendar, Monte Carlo simulation and tension sweep.

Pure computation. Money is an integer count of cents at every boundary; inside the
vectorised simulation amounts are float64 cents because multiplicative shocks
(sales and cost factors) are real numbers. Every result is rounded back to integer
cents before it leaves the engine.
"""

ENGINE_VERSION = "1.0.0"
SCHEMA_VERSION = "v1"
