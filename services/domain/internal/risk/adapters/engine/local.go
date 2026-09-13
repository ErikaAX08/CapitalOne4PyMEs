package engine

import (
	"bufio"
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
)

// worker is the Python side of the local transport: a loop that reads one engine
// request per line and writes one result per line.
//
// It calls engine.analysis.analyze directly, which is exactly what the Lambda
// transport will invoke, so the two transports differ in how bytes travel and in
// nothing else. The engine package is imported once, at start-up, so NumPy is
// paid for once per process rather than once per request.
const worker = `
import json, sys
from engine.analysis import EngineRequest, analyze
sys.stderr.write("engine worker ready\n"); sys.stderr.flush()
for line in sys.stdin:
    line = line.strip()
    if not line:
        continue
    try:
        out = analyze(EngineRequest.from_dict(json.loads(line)))
    except Exception as exc:
        out = {"status": "error", "error": type(exc).__name__, "message": str(exc)}
    sys.stdout.write(json.dumps(out, ensure_ascii=False) + "\n")
    sys.stdout.flush()
`

// LocalTransport runs the engine as a long-lived child process and talks to it
// over stdin and stdout, one JSON document per line.
//
// It exists so the API can be demonstrated before any infrastructure is
// deployed. Requests are serialised: the engine is CPU-bound and a single warm
// interpreter answers in well under the 400 ms debounce, so a pool would add
// failure modes without buying latency.
type LocalTransport struct {
	python    string
	engineDir string
	log       *slog.Logger

	mu     sync.Mutex
	cmd    *exec.Cmd
	stdin  io.WriteCloser
	stdout *bufio.Reader
	closed bool
}

// NewLocalTransport prepares a transport rooted at the engine's source
// directory. The process starts lazily, on the first request.
func NewLocalTransport(python, engineDir string, log *slog.Logger) (*LocalTransport, error) {
	if python == "" {
		python = "python3"
	}
	abs, err := filepath.Abs(engineDir)
	if err != nil {
		return nil, fmt.Errorf("engine directory: %w", err)
	}
	if _, err := os.Stat(filepath.Join(abs, "engine", "analysis.py")); err != nil {
		return nil, fmt.Errorf("no engine found at %s: %w", abs, err)
	}
	if log == nil {
		log = slog.Default()
	}
	return &LocalTransport{python: python, engineDir: abs, log: log}, nil
}

// start launches the worker. The caller holds the mutex.
func (t *LocalTransport) start() error {
	cmd := exec.Command(t.python, "-c", worker)
	cmd.Dir = t.engineDir
	cmd.Env = append(os.Environ(),
		"PYTHONPATH="+t.engineDir,
		"PYTHONUNBUFFERED=1",
	)
	stdin, err := cmd.StdinPipe()
	if err != nil {
		return fmt.Errorf("engine stdin: %w", err)
	}
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("engine stdout: %w", err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("engine stderr: %w", err)
	}
	if err := cmd.Start(); err != nil {
		return fmt.Errorf("starting the engine worker: %w", err)
	}
	go func() {
		scanner := bufio.NewScanner(stderr)
		for scanner.Scan() {
			t.log.Info("engine", "message", scanner.Text())
		}
	}()
	t.cmd, t.stdin, t.stdout = cmd, stdin, bufio.NewReaderSize(stdout, 1<<16)
	return nil
}

// stop tears the worker down. The caller holds the mutex.
func (t *LocalTransport) stop() {
	if t.cmd == nil {
		return
	}
	_ = t.stdin.Close()
	_ = t.cmd.Process.Kill()
	_ = t.cmd.Wait()
	t.cmd, t.stdin, t.stdout = nil, nil, nil
}

// Invoke sends one request and reads one result. A worker that died is replaced
// on the next call rather than poisoning every subsequent request.
func (t *LocalTransport) Invoke(ctx context.Context, payload []byte) ([]byte, error) {
	if bytes.ContainsRune(payload, '\n') {
		return nil, fmt.Errorf("engine request contains a newline; the transport is line-delimited")
	}
	t.mu.Lock()
	defer t.mu.Unlock()
	if t.closed {
		return nil, fmt.Errorf("engine transport is closed")
	}
	if err := ctx.Err(); err != nil {
		return nil, err
	}
	if t.cmd == nil {
		if err := t.start(); err != nil {
			return nil, err
		}
	}
	out, err := t.exchange(ctx, payload)
	if err == nil {
		return out, nil
	}
	// One retry against a worker that died between requests: restarting costs an
	// interpreter start-up, and losing the demo to a stale pipe costs more.
	t.log.Warn("engine worker failed, restarting", "error", err)
	t.stop()
	if err := t.start(); err != nil {
		return nil, err
	}
	return t.exchange(ctx, payload)
}

func (t *LocalTransport) exchange(ctx context.Context, payload []byte) ([]byte, error) {
	type outcome struct {
		line []byte
		err  error
	}
	done := make(chan outcome, 1)
	go func() {
		if _, err := t.stdin.Write(append(payload, '\n')); err != nil {
			done <- outcome{err: fmt.Errorf("writing to the engine: %w", err)}
			return
		}
		line, err := t.stdout.ReadBytes('\n')
		if err != nil {
			done <- outcome{err: fmt.Errorf("reading from the engine: %w", err)}
			return
		}
		done <- outcome{line: line}
	}()
	select {
	case <-ctx.Done():
		// The worker is mid-request and its pipes are no longer in a known
		// state; the next Invoke restarts it.
		t.stop()
		return nil, ctx.Err()
	case res := <-done:
		return res.line, res.err
	}
}

// Close stops the worker.
func (t *LocalTransport) Close() error {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.closed = true
	t.stop()
	return nil
}
