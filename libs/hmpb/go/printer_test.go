package hmpb

import (
	"crypto/sha256"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"testing"
	"time"

	"github.com/kofi-q/vxsweet/libs/elections"
	"github.com/stretchr/testify/require"
)

const (
	ElectionPathGeneral = "../../fixtures/data/electionGeneral/election.json"
)

var (
	//go:embed seal.png
	seal []byte

	tmpdir = os.TempDir()

	election = mockElection()
)

func TestNhGeneral(t *testing.T) {
	printer := NewPrinterHmpb()
	startTotal := time.Now()

	style := election.BallotStyles[0]

	tmpBallotPath := path.Join(tmpdir, "blank-ballot-test-print.pdf")
	file, err := os.Create(tmpBallotPath)
	require.NoError(t, err)
	defer file.Close()

	renderer, err := printer.Ballot(
		&election,
		PrintParams{
			Official:   true,
			PrecinctId: style.Precincts[0],
			StyleId:    style.Id,
			Type:       elections.BallotTypeAbsentee,
		},
		&CfgBase,
	)
	require.NoError(t, err)

	layout := renderer.Layout()

	finalElection := election
	finalElection.GridLayouts = []elections.GridLayout{}
	finalElection.GridLayouts = append(finalElection.GridLayouts, layout)

	electionJson, err := json.Marshal(finalElection)
	require.NoError(t, err)
	hash := sha256.Sum256(electionJson)

	require.NoError(t, renderer.Finalize(file, elections.BallotMetadata{
		Hash:         hex.EncodeToString(hash[0:]),
		QrDataBase64: "VlACmAWcqPQItzl/kgAAAAIQ",
	}))

	fmt.Println("ballot printed", tmpBallotPath)

	fmt.Println("TOTAL TIME:", time.Since(startTotal))
}

func mockElection() (election elections.Election) {
	file, err := os.Open(string(ElectionPathGeneral))
	if err != nil {
		log.Fatalln(err)
	}

	defer func() {
		err := file.Close()
		if err != nil {
			log.Fatalf(
				"Unable to close election.json file after reading: %v",
				err,
			)
		}
	}()

	reader := json.NewDecoder(file)

	err = reader.Decode(&election)
	if err != nil {
		log.Fatalln(err)
	}

	return
}
