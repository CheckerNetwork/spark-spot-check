package main

import (
	"context"
	"os"
	"os/signal"
	"syscall"

	log "github.com/inconshreveable/log15"
)

// main creates a default lassie instance and fetches a CID
func main() {
	// set up a context that is canceled when a command is interrupted
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// set up a signal handler to cancel the context
	go func() {
		interrupt := make(chan os.Signal, 1)
		signal.Notify(interrupt, syscall.SIGTERM, syscall.SIGINT)

		select {
		case <-interrupt:
			log.Info("received interrupt signal")
			cancel()
		case <-ctx.Done():
		}

		// Allow any further SIGTERM or SIGINT to kill process
		signal.Stop(interrupt)
	}()

	if err := app.RunContext(ctx, os.Args); err != nil {
		log.Error("Error", "err", err)
	}
}
