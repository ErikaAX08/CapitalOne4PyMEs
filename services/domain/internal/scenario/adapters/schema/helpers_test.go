package schema_test

import (
	"testing"

	"github.com/ErikaAX08/CapitalOne4PyMEs/services/domain/internal/shared/kernel"
)

func mustCutoff(t *testing.T) kernel.CutoffDate {
	t.Helper()
	c, err := kernel.ParseCutoffDate("2026-09-12")
	if err != nil {
		t.Fatal(err)
	}
	return c
}
