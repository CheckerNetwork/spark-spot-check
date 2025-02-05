package main

import (
	"context"
	"os"

	"github.com/filecoin-project/lassie/pkg/lassie"
	"github.com/filecoin-project/lassie/pkg/storage"
	"github.com/filecoin-project/lassie/pkg/types"
	"github.com/ipfs/go-cid"
	trustlessutils "github.com/ipld/go-trustless-utils"
	"github.com/libp2p/go-libp2p/core/peer"
)

func Retrieve(ctx context.Context, lassie *lassie.Lassie, rootCid cid.Cid, peerInfo *peer.AddrInfo, dagScope trustlessutils.DagScope) (*types.RetrievalStats, error) {
	// Create a request for the content
	store := storage.NewDeferredStorageCar(os.TempDir(), rootCid)
	request, err := types.NewRequestForPath(store, rootCid, "", dagScope, nil)
	if err != nil {
		return nil, err
	}

	request.Providers = append(request.Providers, types.Provider{
		Peer: *peerInfo,
	})

	// Fetch the content
	stats, err := lassie.Fetch(ctx, request)
	if err != nil {
		return nil, err
	}

	return stats, nil
}

func GetDagScope(s string) trustlessutils.DagScope {
	switch s {
	case "all":
		return trustlessutils.DagScopeAll
	case "block":
		return trustlessutils.DagScopeBlock
	case "entity":
		return trustlessutils.DagScopeEntity
	default:
		return trustlessutils.DagScopeBlock
	}
}
