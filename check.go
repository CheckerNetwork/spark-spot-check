package main

import (
	"fmt"

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

	results := make(chan CheckResult, checksCount)
	// Pick a random retrieval task
	for i := 0; i < checksCount; i++ {
		randomIndex := rand.Intn(len(round.RetrievalTasks))
		retrievalTask := round.RetrievalTasks[randomIndex]

		go func() {
			rootCid, err := cid.Parse(retrievalTask.Cid)
			if err != nil {
				results <- CheckResult{Task: retrievalTask, Stats: nil, Err: err}
				return
			}

			minerAddress, err := address.NewFromString(retrievalTask.MinerId)
			if err != nil {
				results <- CheckResult{Task: retrievalTask, Stats: nil, Err: err}
				return
			}

			peerInfo, err := GetMinerInfo(cctx.Context, rpc, minerAddress, rootCid, cctx.String("ipni"))
			if err != nil {
				results <- CheckResult{Task: retrievalTask, Stats: nil, Err: err}
				return
			}

			if peerInfo == nil {
				results <- CheckResult{Task: retrievalTask, Stats: nil, Err: fmt.Errorf("no provider found for CID %s", rootCid.String())}
				return
			}

			dagScope := GetDagScope(cctx.String("dag-scope"))
			log.Debug("Fetching content", "cid", rootCid.String(), "minerId", minerAddress.String(), "peerId", peerInfo.ID.String(), "scope", dagScope)

			stats, err := Retrieve(cctx.Context, lassie, rootCid, peerInfo, dagScope)
			results <- CheckResult{Task: retrievalTask, Stats: stats, Err: err}
		}()
	}

	for result := range results {
		log.Info("Task result", "task", result.Task, "stats", result.Stats, "err", result.Err)
	}

	return nil
}
