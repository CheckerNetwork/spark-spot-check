package main

import "github.com/urfave/cli/v2"

var flags = []cli.Flag{
	&cli.StringFlag{
		Name:    "output",
		Aliases: []string{"o"},
		Value:   "results.json",
		Usage:   "output file",
	},
	&cli.IntFlag{
		Name:    "checks",
		Aliases: []string{"c"},
		Usage:   "number of checks to perform per round; if set to -1 it will perform all checks",
		Value:   10,
	},
	&cli.IntFlag{
		Name:    "round",
		Aliases: []string{"r"},
		Usage:   "round number, -1 for current (latest) round",
		Value:   -1,
	},
	&cli.StringFlag{
		Name:    "meridian-address",
		Aliases: []string{"m"},
		Value:   "0x8460766edc62b525fc1fa4d628fc79229dc73031",
		Usage:   "address of the Meridian smart contract",
	},
	&cli.StringFlag{
		Name:  "dag-scope",
		Usage: "scope of the checks to perform, one of: all, block, range",
		Value: "all",
	},
	&cli.IntFlag{
		Name:  "range-start",
		Usage: "start of the range to check, only used if scope is range",
		Value: 0,
	},
	&cli.IntFlag{
		Name:  "range-end",
		Usage: "end of the range to check, only used if scope is range",
	},
	&cli.StringFlag{
		Name:  "rpc",
		Usage: "Filecoin RPC node endpoint",
		Value: "https://api.node.glif.io/rpc/v1",
	},
	&cli.StringFlag{
		Name:    "ipni",
		Aliases: []string{"i"},
		Usage:   "IPNI API endpoint",
		Value:   "https://cid.contact",
	},
	// TODO: Add loglevel
}

var checkCmd = &cli.Command{
	Name:   "check",
	Usage:  "Fetches content from the IPFS and Filecoin network",
	Action: RunSpotCheck,
	Flags:  flags,
}

var app = &cli.App{
	Name:    "spark-spot-check",
	Usage:   "Utility for retrieving content from the Filecoin network",
	Suggest: true,
	Commands: []*cli.Command{
		checkCmd,
	},
}
