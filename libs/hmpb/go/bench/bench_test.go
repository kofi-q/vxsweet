package bench

import (
	"bytes"
	_ "embed"
	"encoding/hex"
	"encoding/json"
	"log"
	"testing"

	"github.com/kofi-q/vxsweet/libs/elections"
	hmpb "github.com/kofi-q/vxsweet/libs/hmpb/go"
)

var (
	//go:embed election.json
	electionJson []byte
)

func BenchmarkRender(b *testing.B) {
	election := mockElectionBytes(electionJson)
	printer := hmpb.NewPrinterHmpb()
	style := election.BallotStyles[0]
	buf := noopWriter{}

	for b.Loop() {
		r, _ := printer.Ballot(&election, hmpb.PrintParams{
			NoCompress: true,
			Official:   true,
			PrecinctId: style.Precincts[0],
			StyleId:    style.Id,
			Type:       elections.BallotTypeAbsentee,
		}, &hmpb.CfgBase)

		layout := r.Layout()

		finalElection := election
		finalElection.GridLayouts = []elections.GridLayout{}
		finalElection.GridLayouts = append(
			finalElection.GridLayouts,
			layout,
		)

		hash := []byte("0123456789abcdef0123456789abcdef")

		r.Finalize(&buf, hash[:], hex.EncodeToString(hash[:]))
	}
}

type noopWriter struct{}

func (w *noopWriter) Write(data []byte) (int, error) {
	return len(data), nil
}

func mockElectionBytes(data []byte) (election elections.Election) {
	reader := json.NewDecoder(bytes.NewReader(data))
	err := reader.Decode(&election)
	if err != nil {
		log.Fatalln(err)
	}

	return
}
