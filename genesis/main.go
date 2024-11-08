package main

import (
	"encoding/json"
	"flag"
	"fmt"
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
		configPath  string
	)

	flag.StringVar(&genesisPath, "genesis", "./genesis/regtest.json", "geneis path")
	flag.StringVar(&configPath, "config", "./genesis/regtest-config.json", "config path")
	flag.Parse()

	file, err := os.Open(genesisPath)
	if err != nil {
		panic(err)
	}
	defer file.Close()

	confBytes, err := os.ReadFile(configPath)
	if err != nil {
		panic(err)
	}

	var config map[string]any
	if err := json.Unmarshal(confBytes, &config); err != nil {
		panic(err)
	}

	genesis := new(core.Genesis)
	if err := json.NewDecoder(file).Decode(genesis); err != nil {
		panic(err)
	}

	db := rawdb.NewMemoryDatabase()
	triedb := triedb.NewDatabase(db, &triedb.Config{Preimages: true, HashDB: hashdb.Defaults})
	defer triedb.Close()

	block := genesis.MustCommit(db, triedb)
	config["Consensus"].(map[string]any)["Goat"] = block.Header()

	confBytes, err = json.MarshalIndent(config, "", "  ")
	if err != nil {
		panic(err)
	}

	err = os.WriteFile(configPath, confBytes, 0o664)
	if err != nil {
		panic(err)
	}

	fmt.Println("goat-geth genesis block hash", block.Header().Hash().Hex())
}
