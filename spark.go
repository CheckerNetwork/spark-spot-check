package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type Round struct {
	RoundId         string
	StartEpoch      string
	MaxTasksPerNode int
	RetrievalTasks  []RetrievalTask
}

type RetrievalTask struct {
	Cid     string
	MinerId string
	Clients []string
}

func GetSparkRound(roundNum int, meridianContract string) (*Round, error) {
	url := getRoundUrl(roundNum, meridianContract)
	resp, err := http.Get(url)
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	// Read the response body
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	// Parse JSON response
	var data Round
	err = json.Unmarshal(body, &data)
	if err != nil {
		return nil, err
	}

	return &data, nil
}

func getRoundUrl(roundNum int, meridianContact string) string {
	if roundNum == -1 {
		return "https://api.filspark.com/rounds/current"
	}

	return fmt.Sprintf("https://api.filspark.com/rounds/meridian/%s/%d", meridianContact, roundNum)
}
