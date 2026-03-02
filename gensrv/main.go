package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/signal"
	"syscall"

	"github.com/ethereum/go-ethereum/core"
	"github.com/ethereum/go-ethereum/core/rawdb"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/triedb"
	"github.com/ethereum/go-ethereum/triedb/hashdb"
)

const defaultPort = 8080

func parseListenAddr(args []string) (string, error) {
	flagSet := flag.NewFlagSet("gensrv", flag.ContinueOnError)
	flagSet.SetOutput(io.Discard)

	port := flagSet.Int("port", defaultPort, "HTTP listen port")
	if err := flagSet.Parse(args); err != nil {
		return "", err
	}

	if *port < 1 || *port > 65535 {
		return "", fmt.Errorf("invalid port %d: must be in range [1, 65535]", *port)
	}

	return fmt.Sprintf(":%d", *port), nil
}

func genFromReader(body io.Reader) (*types.Header, error) {
	genesis := new(core.Genesis)
	if err := json.NewDecoder(body).Decode(genesis); err != nil {
		return nil, fmt.Errorf("invalid genesis request: %w", err)
	}

	db := rawdb.NewMemoryDatabase()
	triedb := triedb.NewDatabase(db, &triedb.Config{Preimages: true, HashDB: hashdb.Defaults})

	block, err := genesis.Commit(db, triedb, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to commit genesis block: %w", err)
	}
	if err := triedb.Close(); err != nil {
		return nil, fmt.Errorf("failed to close trie database: %w", err)
	}
	return block.Header(), nil
}

func gen(r *http.Request) (*types.Header, error) {
	return genFromReader(r.Body)
}

func genesisHandler(w http.ResponseWriter, r *http.Request) {
	header, err := gen(r)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(header)
}

func pingHandler(w http.ResponseWriter, _ *http.Request) {
	_, _ = fmt.Fprintf(w, "pong")
}

func newMux() *http.ServeMux {
	mux := http.NewServeMux()
	mux.HandleFunc("/genesis", genesisHandler)
	mux.HandleFunc("/", pingHandler)
	return mux
}

func newServer(addr string) *http.Server {
	return &http.Server{Addr: addr, Handler: newMux()}
}

func main() {
	addr, err := parseListenAddr(os.Args[1:])
	if err != nil {
		fmt.Fprintf(os.Stderr, "invalid CLI args: %v\n", err)
		os.Exit(2)
	}

	server := newServer(addr)

	go func() {
		fmt.Printf("Starting gensrv on %s\n", addr)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("ListenAndServe(): %s\n", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	fmt.Println("Shutting down server...")

	if err := server.Shutdown(context.Background()); err != nil {
		fmt.Printf("Server forced to shutdown: %s\n", err)
	}

	fmt.Println("Server exiting")
}
