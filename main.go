package main

import (
	"encoding/json"
	"flag"
	"os"

	"github.com/ethereum/go-ethereum/core"
	"github.com/ethereum/go-ethereum/core/rawdb"
	"github.com/ethereum/go-ethereum/triedb"
	"github.com/ethereum/go-ethereum/triedb/hashdb"
)

// create geneis block from genesis config

func main() {
	var (
		genesisPath string
	)

	flag.StringVar(&genesisPath, "genesis", "./ignition/genesis/regtest.json", "geneis path")
	flag.Parse()

	file, err := os.Open(genesisPath)
	if err != nil {
		panic(err)
	}
	defer file.Close()

	genesis := new(core.Genesis)
	if err := json.NewDecoder(file).Decode(genesis); err != nil {
		panic(err)
	}

	db := rawdb.NewMemoryDatabase()
	triedb := triedb.NewDatabase(db, &triedb.Config{Preimages: true, HashDB: hashdb.Defaults})
	defer triedb.Close()

	block := genesis.MustCommit(db, triedb)

	print := json.NewEncoder(os.Stdout)
	print.SetIndent(" ", " ")
	_ = print.Encode(block.Header())
}
