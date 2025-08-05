package hmpb

import (
	"bytes"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"log"
	"os"
	"testing"

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

	var mockFile bytes.Buffer

	style := election.BallotStyles[0]
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

	_, hash, err := finalElection.MarshalAndHash()
	require.NoError(t, err)

	require.NoError(
		t,
		renderer.Finalize(&mockFile, hash[:], hex.EncodeToString(hash[:])),
	)
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
