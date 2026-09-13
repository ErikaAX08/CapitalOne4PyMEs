"""Engine error types."""


class DataQualityError(ValueError):
    """Raised when the input cannot be trusted: unknown balance, future information,
    inconsistent reconciliation. An unknown value is never replaced with zero."""


class ParameterError(ValueError):
    """Raised when an action or stress parameter violates its declared bounds."""
