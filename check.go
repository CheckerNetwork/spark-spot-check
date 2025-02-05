package main

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"

	log "github.com/inconshreveable/log15"

	"github.com/filecoin-project/go-address"
	"github.com/filecoin-project/lassie/pkg/lassie"
	"github.com/filecoin-project/lassie/pkg/types"
	"github.com/filecoin-project/lotus/api/client"
	"github.com/ipfs/go-cid"
	"github.com/urfave/cli/v2"
	"golang.org/x/exp/rand"
)

type CheckResult struct {
	Task  RetrievalTask
	Stats *types.RetrievalStats
	Err   error
}

func (c CheckResult) MarshalJSON() ([]byte, error) {
	return json.Marshal(struct {
		Task  RetrievalTask
		Stats *types.RetrievalStats
		Err   string
	}{
		Task:  c.Task,
		Stats: c.Stats,
		Err:   c.Err.Error(),
	})
}

func RunSpotCheck(cctx *cli.Context) error {
	rpc, closeRpc, err := client.NewFullNodeRPCV1(cctx.Context, cctx.String("rpc"), nil)
	if err != nil {
		return err
	}

	defer closeRpc()

	// Create a default lassie instance
	lassie, err := lassie.NewLassie(cctx.Context)
	if err != nil {
		return err
	}

	roundNum := cctx.Int("round")
	meridianContract := cctx.String("meridian-address")
	round, err := GetSparkRound(roundNum, meridianContract)
	if err != nil {
		return err
	}

	checksCount := cctx.Int("checks")
	if checksCount == -1 {
		checksCount = len(round.RetrievalTasks)
	}

	// Create new results file
	file, err := os.Create(cctx.String("output"))
	if err != nil {
		return err
	}

	encoder := json.NewEncoder(file)

	var wg sync.WaitGroup
	// Run checks concurrently
	resultChan := make(chan CheckResult, checksCount)
	for i := 0; i < checksCount; i++ {
		// Pick a random retrieval task
		randomIndex := rand.Intn(len(round.RetrievalTasks))
		retrievalTask := round.RetrievalTasks[randomIndex]

		wg.Add(1)
		go func() {
			defer wg.Done()

			rootCid, err := cid.Parse(retrievalTask.Cid)
			if err != nil {
				resultChan <- CheckResult{Task: retrievalTask, Stats: nil, Err: fmt.Errorf("failed to parse CID: %w", err)}
				return
			}

			minerAddress, err := address.NewFromString(retrievalTask.MinerId)
			if err != nil {
				resultChan <- CheckResult{Task: retrievalTask, Stats: nil, Err: fmt.Errorf("failed to parse miner address: %w", err)}
				return
			}

			peerInfo, err := GetMinerInfo(cctx.Context, rpc, minerAddress, rootCid, cctx.String("ipni"))
			if err != nil {
				resultChan <- CheckResult{Task: retrievalTask, Stats: nil, Err: fmt.Errorf("failed to get miner info: %w", err)}
				return
			}

			if peerInfo == nil {
				resultChan <- CheckResult{Task: retrievalTask, Stats: nil, Err: fmt.Errorf("no provider found for CID %s", rootCid.String())}
				return
			}

			dagScope := GetDagScope(cctx.String("dag-scope"))
			log.Debug("Fetching content", "cid", rootCid.String(), "minerId", minerAddress.String(), "peerId", peerInfo.ID.String(), "scope", dagScope)

			stats, err := Retrieve(cctx.Context, lassie, rootCid, peerInfo, dagScope)
			resultChan <- CheckResult{Task: retrievalTask, Stats: stats, Err: err}
		}()
	}

	wg.Wait()
	close(resultChan)

	// Write results to file
	results := make([]CheckResult, 0, checksCount)
	for result := range resultChan {
		results = append(results, result)
	}

	return encoder.Encode(results)
}
