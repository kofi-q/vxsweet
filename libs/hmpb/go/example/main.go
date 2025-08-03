package main

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"sync"
	"time"

	"github.com/kofi-q/vxsweet/libs/elections"
	hmpb "github.com/kofi-q/vxsweet/libs/hmpb/go"
)

var (
	electionPathGeneral = os.Getenv("ELECTION_GENERAL")
	electionPathNh      = os.Getenv("ELECTION_NH")
	reporoot            = os.Getenv("BUILD_WORKSPACE_DIRECTORY")

	electionGeneral = mockElection(electionPathGeneral)
	electionNh      = mockElection(electionPathNh)
	outpath         = path.Join(reporoot, "libs/hmpb/go/example")
)

func main() {
	printer := hmpb.NewPrinterHmpb()
	election := electionGeneral

	startTotal := time.Now()

	switch 0 {
	case 0:
		genSingleBallot(&printer, &election)
	case 1:
		genMultiBallotElection(&printer, &election)
	case 2:
		genParallelBallots(&printer, 20)
	default:
		panic("\ninvalid mode")
	}

	fmt.Println("TOTAL TIME:", time.Since(startTotal))
}

func genSingleBallot(printer hmpb.Printer, election *elections.Election) {
	tmpBallotPath := path.Join(outpath, "blank-ballot-test-print.pdf")
	file, err := os.Create(tmpBallotPath)
	assertNoErr(err)
	defer file.Close()

	style := election.BallotStyles[0]
	renderer, err := printer.Ballot(
		election,
		hmpb.PrintParams{
			NoCompress: true,
			Official:   true,
			PrecinctId: style.Precincts[0],
			StyleId:    style.Id,
			// StyleId: "12_zh-Hans",
			Type: elections.BallotTypeAbsentee,
		},
		&hmpb.CfgBase,
	)
	assertNoErr(err)

	layout := renderer.Layout()

	finalElection := electionGeneral
	finalElection.GridLayouts = []elections.GridLayout{}
	finalElection.GridLayouts = append(finalElection.GridLayouts, layout)

	_, hash, err := finalElection.MarshalAndHash()
	assertNoErr(err)

	assertNoErr(renderer.Finalize(file, hash))

	fmt.Println("Ballot printed to:", tmpBallotPath)
}

func genMultiBallotElection(
	printer hmpb.Printer,
	election *elections.Election,
) {
	outdir := path.Join(os.TempDir(), "multi-ballot-election")
	os.MkdirAll(outdir, 0o755)

	packager := hmpb.Packager{
		Cfg:      &hmpb.CfgBase,
		Election: election,
		OutDir:   outdir,
		Printer:  printer,
	}

	pkg, err := packager.All()
	assertNoErr(err)

	fmt.Println("Ballot count:", len(pkg.Ballots))
	fmt.Println("Output dir:", outdir)
}

func genParallelBallots(printer hmpb.Printer, count uint64) {
	style := electionGeneral.BallotStyles[0]

	var wg sync.WaitGroup

	for range count {
		wg.Add(1)
		go func() {
			defer wg.Done()

			var buf bytes.Buffer
			defer buf.Reset()

			r, err := printer.Ballot(&electionGeneral, hmpb.PrintParams{
				NoCompress: true,
				Official:   true,
				PrecinctId: style.Precincts[0],
				StyleId:    style.Id,
				Type:       elections.BallotTypeAbsentee,
			}, &hmpb.CfgBase)
			assertNoErr(err)

			layout := r.Layout()

			finalElection := electionGeneral
			finalElection.GridLayouts = []elections.GridLayout{}
			finalElection.GridLayouts = append(
				finalElection.GridLayouts,
				layout,
			)

			_, hash, err := finalElection.MarshalAndHash()
			assertNoErr(err)

			assertNoErr(r.Finalize(&buf, hash))
		}()
	}

	wg.Wait()
}

func assertNoErr(err error) {
	if err != nil {
		log.Fatalln(err)
	}
}

func mockElection(filename string) (election elections.Election) {
	file, err := os.Open(filename)
	if err != nil {
		log.Fatalln(err)
	}

	reader := json.NewDecoder(file)
	err = reader.Decode(&election)
	if err != nil {
		log.Fatalln(err)
	}

	err = file.Close()
	if err != nil {
		log.Fatalf(
			"Unable to close election.json file after reading: %v",
			err,
		)
	}

	return
}
