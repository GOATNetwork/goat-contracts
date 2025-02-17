package main

import (
	"context"
	"encoding/json"
	"fmt"
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

func gen(r *http.Request) (*types.Header, error) {
	genesis := new(core.Genesis)
	if err := json.NewDecoder(r.Body).Decode(genesis); err != nil {
		return nil, fmt.Errorf("invalid genesis request: %w", err)
	}

	db := rawdb.NewMemoryDatabase()
	triedb := triedb.NewDatabase(db, &triedb.Config{Preimages: true, HashDB: hashdb.Defaults})
	defer triedb.Close()

	block, err := genesis.Commit(db, triedb)
	if err != nil {
		return nil, fmt.Errorf("failed to commit genesis block: %w", err)
	}
	return block.Header(), nil
}

func main() {
	server := &http.Server{Addr: ":8080"}

	http.HandleFunc("/genesis", func(w http.ResponseWriter, r *http.Request) {
		header, err := gen(r)
		if err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(header)
	})

	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		_, _ = fmt.Fprintf(w, "pong")
	})

	go func() {
		fmt.Println("Starting gensrv on :8080")
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
