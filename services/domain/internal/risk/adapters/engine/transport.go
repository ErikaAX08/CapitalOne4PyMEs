package engine

import "context"

// Transport carries one engine request and returns the engine's raw result.
//
// It is deliberately byte-in, byte-out: the shape of the payload is the
// contract, and swapping how it travels — a local worker today, lambda:Invoke
// once infrastructure exists — must not touch the translator.
type Transport interface {
	Invoke(ctx context.Context, payload []byte) ([]byte, error)
	Close() error
}

type correlationKey struct{}

// WithCorrelationID attaches the id that travels from the edge to Go to Python.
// It is what saves a 3 a.m. debug (docs/architecture.md §11).
func WithCorrelationID(ctx context.Context, id string) context.Context {
	if id == "" {
		return ctx
	}
	return context.WithValue(ctx, correlationKey{}, id)
}

// CorrelationID reads the id back, empty when none was attached.
func CorrelationID(ctx context.Context) string {
	id, _ := ctx.Value(correlationKey{}).(string)
	return id
}
