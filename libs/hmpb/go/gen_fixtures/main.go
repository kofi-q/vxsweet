package main

import (
	"cmp"
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

	outdir = path.Join(reporoot, "libs/hmpb/go/fixtures")

	outdirAllBubbleCustom17 = outdir + "/all_bubble/custom-8.5x17"
	outdirAllBubbleCustom19 = outdir + "/all_bubble/custom-8.5x19"
	outdirAllBubbleCustom22 = outdir + "/all_bubble/custom-8.5x22"
	outdirAllBubbleLegal    = outdir + "/all_bubble/legal"
	outdirAllBubbleLetter   = outdir + "/all_bubble/letter"
	outdirGridOnlyCustom17  = outdir + "/grid_only/custom-8.5x17"
	outdirGridOnlyCustom19  = outdir + "/grid_only/custom-8.5x19"
	outdirGridOnlyCustom22  = outdir + "/grid_only/custom-8.5x22"
	outdirGridOnlyLegal     = outdir + "/grid_only/legal"
	outdirGridOnlyLetter    = outdir + "/grid_only/letter"
	outdirNhGeneralLegal    = outdir + "/nh_general/legal"
	outdirNhGeneralLetter   = outdir + "/nh_general/letter"
	outdirVxGeneralCustom17 = outdir + "/vx_general/custom-8.5x17"
	outdirVxGeneralCustom19 = outdir + "/vx_general/custom-8.5x19"
	outdirVxGeneralCustom22 = outdir + "/vx_general/custom-8.5x22"
	outdirVxGeneralLegal    = outdir + "/vx_general/legal"
	outdirVxGeneralLetter   = outdir + "/vx_general/letter"
)

type Fixture struct {
	outdir    string
	paperSize elections.PaperSize
}

func main() {
	start := time.Now()

	err := cmp.Or(
		os.RemoveAll(outdir),

		os.MkdirAll(outdirAllBubbleCustom17, 0o755),
		os.MkdirAll(outdirAllBubbleCustom19, 0o755),
		os.MkdirAll(outdirAllBubbleCustom22, 0o755),
		os.MkdirAll(outdirAllBubbleLegal, 0o755),
		os.MkdirAll(outdirAllBubbleLetter, 0o755),

		os.MkdirAll(outdirGridOnlyCustom17, 0o755),
		os.MkdirAll(outdirGridOnlyCustom19, 0o755),
		os.MkdirAll(outdirGridOnlyCustom22, 0o755),
		os.MkdirAll(outdirGridOnlyLegal, 0o755),
		os.MkdirAll(outdirGridOnlyLetter, 0o755),

		os.MkdirAll(outdirNhGeneralLegal, 0o755),
		os.MkdirAll(outdirNhGeneralLetter, 0o755),

		os.MkdirAll(outdirVxGeneralCustom17, 0o755),
		os.MkdirAll(outdirVxGeneralCustom19, 0o755),
		os.MkdirAll(outdirVxGeneralCustom22, 0o755),
		os.MkdirAll(outdirVxGeneralLegal, 0o755),
		os.MkdirAll(outdirVxGeneralLetter, 0o755),
	)
	if err != nil {
		log.Fatalln("unable to create output directory", err)
	}

	ballotStyle12Ptr := electionGeneral.BallotStyle("12")
	if ballotStyle12Ptr == nil {
		panic("expected ballot style 12 is missing")
	}
	ballotStyle12 := *ballotStyle12Ptr
	ballotStyle12.Precincts = []string{ballotStyle12.Precincts[0]}

	electionSingleBallot := electionGeneral
	electionSingleBallot.BallotStyles = []elections.BallotStyle{ballotStyle12}

	printer := hmpb.NewPrinterHmpb()
	var wg sync.WaitGroup

	// Vx General Election - multi-language legal paper ballots:
	wg.Add(1)
	go func() {
		defer wg.Done()
		packager := hmpb.Packager{
			BallotTypes: []elections.BallotType{
				elections.BallotTypePrecinct,
			},
			Cfg:      &hmpb.CfgBase,
			Election: &electionGeneral,
			OutDir:   outdirVxGeneralLegal,
			Printer:  &printer,
		}

		_, err := packager.All()
		if err != nil {
			log.Fatalln("packager failed:", err)
		}
	}()

	// Vx General Election - alternate paper sizes:
	for _, f := range []Fixture{
		{outdirVxGeneralCustom17, elections.PaperSizeCustom17},
		{outdirVxGeneralCustom19, elections.PaperSizeCustom19},
		{outdirVxGeneralCustom22, elections.PaperSizeCustom22},
		{outdirVxGeneralLetter, elections.PaperSizeLetter},
	} {
		wg.Add(1)
		go func() {
			defer wg.Done()

			electionGeneral := electionSingleBallot
			electionGeneral.BallotLayout = elections.BallotLayout{
				PaperSize: f.paperSize,
			}

			packager := hmpb.Packager{
				BallotTypes: []elections.BallotType{
					elections.BallotTypePrecinct,
				},
				Cfg:      &hmpb.CfgBase,
				Election: &electionGeneral,
				OutDir:   f.outdir,
				Printer:  &printer,
			}

			_, err := packager.All()
			if err != nil {
				log.Fatalln("packager failed:", err)
			}
		}()
	}

	// NH General Election:
	for _, f := range []Fixture{
		{outdirNhGeneralLegal, elections.PaperSizeLegal},
		{outdirNhGeneralLetter, elections.PaperSizeLetter},
	} {
		wg.Add(1)
		go func() {
			defer wg.Done()

			election := electionNh
			style := election.BallotStyles[0]
			style.Precincts = []string{style.Precincts[0]}
			election.BallotStyles = []elections.BallotStyle{style}
			election.BallotLayout = elections.BallotLayout{
				PaperSize: f.paperSize,
			}

			packager := hmpb.Packager{
				BallotTypes: []elections.BallotType{
					elections.BallotTypePrecinct,
				},
				Cfg:      &hmpb.CfgNh,
				Election: &election,
				OutDir:   f.outdir,
				Printer:  &printer,
			}

			_, err := packager.All()
			if err != nil {
				log.Fatalln(f.paperSize, "NH election failed:", err)
			}
		}()
	}

	// All-bubble ballots:
	for _, f := range []Fixture{
		{outdirAllBubbleCustom17, elections.PaperSizeCustom17},
		{outdirAllBubbleCustom19, elections.PaperSizeCustom19},
		{outdirAllBubbleCustom22, elections.PaperSizeCustom22},
		{outdirAllBubbleLegal, elections.PaperSizeLegal},
		{outdirAllBubbleLetter, elections.PaperSizeLetter},
	} {
		wg.Add(1)
		go func() {
			defer wg.Done()

			file, err := os.Create(f.outdir + "/blank_ballot.pdf")
			if err != nil {
				log.Fatalln("unable to open all-bubble file for writing:", err)
			}
			defer file.Close()

			election, err := printer.BallotAllBubble(
				file,
				&hmpb.CfgAllBubble,
				f.paperSize,
			)
			if err != nil {
				log.Fatalln("all-bubble ballot generation failed:", err)
			}

			fileElection, err := os.Create(f.outdir + "/election.json")
			if err != nil {
				log.Fatalln(
					"unable to open all-bubble election def for writing:", err,
				)
			}

			enc := json.NewEncoder(fileElection)
			enc.SetIndent("", "  ")
			err = enc.Encode(election)
			if err != nil {
				log.Fatalln("unable to write all-bubble election def:", err)
			}
		}()
	}

	// Grid-only sheets:
	for _, f := range []Fixture{
		{outdirGridOnlyCustom17, elections.PaperSizeCustom17},
		{outdirGridOnlyCustom19, elections.PaperSizeCustom19},
		{outdirGridOnlyCustom22, elections.PaperSizeCustom22},
		{outdirGridOnlyLegal, elections.PaperSizeLegal},
		{outdirGridOnlyLetter, elections.PaperSizeLetter},
	} {
		wg.Add(1)
		go func() {
			defer wg.Done()

			file, err := os.Create(f.outdir + "/standard.pdf")
			if err != nil {
				log.Fatalln("unable to open grid-only doc for writing:", err)
			}
			defer file.Close()

			err = printer.BallotGridOnly(file, &hmpb.CfgBase, f.paperSize)
			if err != nil {
				log.Fatalln("grid-only doc generation failed:", err)
			}
		}()
	}

	wg.Wait()

	fmt.Println("\n✅ Done:", time.Since(start))
}

func mockElection(filename string) (election elections.Election) {
	file, err := os.Open(filename)
	if err != nil {
		log.Fatalln("unable to open election definition for reading:", err)
	}

	reader := json.NewDecoder(file)

	err = reader.Decode(&election)
	if err != nil {
		log.Fatalln("unable to decode election JSON:", err)
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
