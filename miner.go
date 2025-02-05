package main

import (
	"context"

	"github.com/filecoin-project/go-address"
	"github.com/filecoin-project/lotus/api"
	chain "github.com/filecoin-project/lotus/chain/types"
	log "github.com/inconshreveable/log15"
	"github.com/ipfs/go-cid"
	"github.com/libp2p/go-libp2p/core/peer"
)

func GetMinerInfo(ctx context.Context, rpc api.FullNode, minerAddress address.Address, rootCid cid.Cid, ipniEndpoint string) (*peer.AddrInfo, error) {
	log.Debug("Fetching miner info for miner", "minerId", minerAddress.String())
	tipset := chain.NewTipSetKey()
	minerInfo, err := rpc.StateMinerInfo(ctx, minerAddress, tipset)
	if err != nil {
		return nil, err
	}

	log.Debug("Finding provider for CID", "cid", rootCid.String())
	peerInfo, err := GetMinerPeerInfo(ctx, ipniEndpoint, rootCid, minerInfo)
	if err != nil {
		return nil, err
	}

	return peerInfo, err
}
