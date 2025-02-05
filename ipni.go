package main

import (
	"context"

	"github.com/filecoin-project/lotus/api"
	"github.com/ipfs/go-cid"
	ipni "github.com/ipni/go-libipni/find/client"
	"github.com/libp2p/go-libp2p/core/peer"
)

func GetMinerPeerInfo(ctx context.Context, ipniProvider string, rootCid cid.Cid, minerInfo api.MinerInfo) (*peer.AddrInfo, error) {
	cl, err := ipni.New(ipniProvider)
	if err != nil {
		return nil, err
	}

	resp, err := cl.Find(ctx, rootCid.Hash())
	if err != nil {
		return nil, err
	}

	var peerInfo *peer.AddrInfo
	for _, mhr := range resp.MultihashResults {
		for _, pr := range mhr.ProviderResults {
			if pr.Provider.ID.String() == minerInfo.PeerId.String() {
				peerInfo = pr.Provider
				break
			}
		}
	}

	return peerInfo, nil
}
