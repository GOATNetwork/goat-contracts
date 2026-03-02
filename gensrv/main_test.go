package main

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/ethereum/go-ethereum/core"
	"github.com/ethereum/go-ethereum/params"
)

func validGenesisPayload(t *testing.T) []byte {
	t.Helper()
	payload, err := json.Marshal(core.DefaultGenesisBlock())
	if err != nil {
		t.Fatalf("marshal genesis payload: %v", err)
	}
	return payload
}

func TestGenFromReaderInvalidJSON(t *testing.T) {
	_, err := genFromReader(bytes.NewBufferString("{invalid json"))
	if err == nil {
		t.Fatalf("expected error for invalid payload")
	}
}

func TestGenFromReaderValidJSON(t *testing.T) {
	header, err := genFromReader(bytes.NewReader(validGenesisPayload(t)))
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if header == nil {
		t.Fatalf("expected non-nil header")
	}
	if header.Hash() != params.MainnetGenesisHash {
		t.Fatalf("expected header hash %s, got %s", params.MainnetGenesisHash, header.Hash())
	}
}

func TestGenesisHandlerBadRequest(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/genesis", bytes.NewBufferString("bad"))
	rr := httptest.NewRecorder()

	genesisHandler(rr, req)

	if rr.Code != http.StatusBadRequest {
		t.Fatalf("expected status %d, got %d", http.StatusBadRequest, rr.Code)
	}
}

func TestGenesisHandlerOK(t *testing.T) {
	req := httptest.NewRequest(http.MethodPost, "/genesis", bytes.NewReader(validGenesisPayload(t)))
	rr := httptest.NewRecorder()

	genesisHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rr.Code)
	}
	if got := rr.Header().Get("Content-Type"); got != "application/json" {
		t.Fatalf("expected content type application/json, got %q", got)
	}
}

func TestPingHandler(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()

	pingHandler(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status %d, got %d", http.StatusOK, rr.Code)
	}
	if rr.Body.String() != "pong" {
		t.Fatalf("expected body pong, got %q", rr.Body.String())
	}
}

func TestParseListenAddrDefault(t *testing.T) {
	addr, err := parseListenAddr(nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if addr != ":8080" {
		t.Fatalf("expected default addr :8080, got %s", addr)
	}
}

func TestParseListenAddrCustomPort(t *testing.T) {
	addr, err := parseListenAddr([]string{"-port", "9090"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if addr != ":9090" {
		t.Fatalf("expected addr :9090, got %s", addr)
	}
}

func TestParseListenAddrInvalidPort(t *testing.T) {
	_, err := parseListenAddr([]string{"-port", "70000"})
	if err == nil {
		t.Fatalf("expected error for invalid port")
	}
}
