package main

import (
	"bufio"
	"cmp"
	"encoding/hex"
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
	electionPathFamousNames = os.Getenv("ELECTION_FAMOUS_NAMES")
	electionPathGeneral     = os.Getenv("ELECTION_GENERAL")
	electionPathNh          = os.Getenv("ELECTION_NH")
	reporoot                = os.Getenv("BUILD_WORKSPACE_DIRECTORY")
	votesPathFamousNames    = os.Getenv("VOTES_FAMOUS_NAMES")
	votesPathGeneral        = os.Getenv("VOTES_GENERAL")
	votesPathNh             = os.Getenv("VOTES_NH")

	electionFamousNames = mockElection(electionPathFamousNames)
	electionGeneral     = mockElection(electionPathGeneral)
	electionNh          = mockElection(electionPathNh)

	votesFamousNames = mockVotes(votesPathFamousNames)
	votesGeneral     = mockVotes(votesPathGeneral)
	votesNh          = mockVotes(votesPathNh)

	outdir = path.Join(reporoot, "libs/hmpb/go/fixtures")

	outdirAllBubbleCustom17    = outdir + "/all_bubble/custom-8.5x17"
	outdirAllBubbleCustom19    = outdir + "/all_bubble/custom-8.5x19"
	outdirAllBubbleCustom22    = outdir + "/all_bubble/custom-8.5x22"
	outdirAllBubbleLegal       = outdir + "/all_bubble/legal"
	outdirAllBubbleLetter      = outdir + "/all_bubble/letter"
	outdirGridOnlyCustom17     = outdir + "/grid_only/custom-8.5x17"
	outdirGridOnlyCustom19     = outdir + "/grid_only/custom-8.5x19"
	outdirGridOnlyCustom22     = outdir + "/grid_only/custom-8.5x22"
	outdirGridOnlyLegal        = outdir + "/grid_only/legal"
	outdirGridOnlyLetter       = outdir + "/grid_only/letter"
	outdirNhGeneralLegal       = outdir + "/nh_general/legal"
	outdirNhGeneralLetter      = outdir + "/nh_general/letter"
	outdirVxFamousNames        = outdir + "/vx_famous_names"
	outdirVxGeneralCustom17    = outdir + "/vx_general/custom-8.5x17"
	outdirVxGeneralCustom19    = outdir + "/vx_general/custom-8.5x19"
	outdirVxGeneralCustom22    = outdir + "/vx_general/custom-8.5x22"
	outdirVxGeneralLegal       = outdir + "/vx_general/legal"
	outdirVxGeneralLegalEsUs   = outdir + "/vx_general/legal-es-US"
	outdirVxGeneralLegalZhHans = outdir + "/vx_general/legal-zh-Hans"
	outdirVxGeneralLegalZhHant = outdir + "/vx_general/legal-zh-Hant"
	outdirVxGeneralLetter      = outdir + "/vx_general/letter"
)

type Fixture struct {
	outdir    string
	paperSize elections.PaperSize
	lang      string
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

		os.MkdirAll(outdirVxFamousNames, 0o755),

		os.MkdirAll(outdirVxGeneralCustom17, 0o755),
		os.MkdirAll(outdirVxGeneralCustom19, 0o755),
		os.MkdirAll(outdirVxGeneralCustom22, 0o755),
		os.MkdirAll(outdirVxGeneralLegal, 0o755),
		os.MkdirAll(outdirVxGeneralLegalEsUs, 0o755),
		os.MkdirAll(outdirVxGeneralLegalZhHans, 0o755),
		os.MkdirAll(outdirVxGeneralLegalZhHant, 0o755),
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

	// Vx General Election:
	for _, f := range []Fixture{
		{outdirVxGeneralCustom17, elections.PaperSizeCustom17, "en"},
		{outdirVxGeneralCustom19, elections.PaperSizeCustom19, "en"},
		{outdirVxGeneralCustom22, elections.PaperSizeCustom22, "en"},
		{outdirVxGeneralLegal, elections.PaperSizeLegal, "en"},
		{outdirVxGeneralLegalEsUs, elections.PaperSizeLegal, "es-US"},
		{outdirVxGeneralLegalZhHans, elections.PaperSizeLegal, "zh-Hans"},
		{outdirVxGeneralLegalZhHant, elections.PaperSizeLegal, "zh-Hant"},
		{outdirVxGeneralLetter, elections.PaperSizeLetter, "en"},
	} {
		wg.Add(1)
		go func() {
			defer wg.Done()

			electionGeneral := electionSingleBallot
			electionGeneral.BallotLayout = electionSingleBallot.BallotLayout
			electionGeneral.BallotLayout.PaperSize = f.paperSize
			ballotStyle := ballotStyle12
			ballotStyle.Languages = []string{f.lang}
			electionGeneral.BallotStyles = []elections.BallotStyle{ballotStyle}

			votes, ok := votesGeneral[ballotStyle.Id]
			if !ok {
				log.Fatalln(
					"missing votes for Vx General Election, ballot style:",
					ballotStyle.Id,
				)
			}

			genBlankAndMarked(
				&printer,
				&hmpb.CfgBase,
				&electionGeneral,
				&ballotStyle,
				ballotStyle12.Precincts[0],
				votes,
				f.outdir,
			)
		}()
	}

	// Vx Famous Names Election:
	wg.Add(1)
	go func() {
		defer wg.Done()

		ballotStyle := &electionFamousNames.BallotStyles[0]
		votes, ok := votesFamousNames[ballotStyle.Id]
		if !ok {
			log.Fatalln(
				"missing votes for Famous Names, ballot style:",
				ballotStyle.Id,
			)
		}

		genBlankAndMarked(
			&printer,
			&hmpb.CfgBase,
			&electionFamousNames,
			ballotStyle,
			ballotStyle.Precincts[0],
			votes,
			outdirVxFamousNames,
		)
	}()

	// NH General Election:
	for _, f := range []Fixture{
		{outdirNhGeneralLegal, elections.PaperSizeLegal, "en"},
		{outdirNhGeneralLetter, elections.PaperSizeLetter, "en"},
	} {
		wg.Add(1)
		go func() {
			defer wg.Done()

			election := electionNh
			style := election.BallotStyles[0]
			style.Precincts = []string{style.Precincts[0]}
			election.BallotStyles = []elections.BallotStyle{style}
			election.BallotLayout = electionNh.BallotLayout
			election.BallotLayout.PaperSize = f.paperSize

			votes, ok := votesNh[style.Id]
			if !ok {
				log.Fatalln(
					"missing votes for NH General Election, ballot style:",
					style.Id,
				)
			}

			genBlankAndMarked(
				&printer,
				&hmpb.CfgNh,
				&election,
				&style,
				style.Precincts[0],
				votes,
				f.outdir,
			)
		}()
	}

	// All-bubble ballots:
	for _, f := range []Fixture{
		{outdirAllBubbleCustom17, elections.PaperSizeCustom17, "en"},
		{outdirAllBubbleCustom19, elections.PaperSizeCustom19, "en"},
		{outdirAllBubbleCustom22, elections.PaperSizeCustom22, "en"},
		{outdirAllBubbleLegal, elections.PaperSizeLegal, "en"},
		{outdirAllBubbleLetter, elections.PaperSizeLetter, "en"},
	} {
		wg.Add(1)
		go func() {
			defer wg.Done()

			fileBallot, err := os.Create(f.outdir + "/blank-ballot.pdf")
			if err != nil {
				log.Fatalln("unable to open all-bubble file for writing:", err)
			}
			defer fileBallot.Close()

			bufWriter := bufio.NewWriter(fileBallot)
			defer bufWriter.Flush()

			election, err := printer.BallotAllBubble(
				bufWriter,
				&hmpb.CfgAllBubble,
				f.paperSize,
				hmpb.AllBubbleBallotBlank,
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

		wg.Add(1)
		go func() {
			defer wg.Done()

			file, err := os.Create(f.outdir + "/cycling-test-deck.pdf")
			if err != nil {
				log.Fatalln("unable to open all-bubble file for writing:", err)
			}
			defer file.Close()

			bufWriter := bufio.NewWriter(file)
			defer bufWriter.Flush()

			_, err = printer.BallotAllBubble(
				bufWriter,
				&hmpb.CfgAllBubble,
				f.paperSize,
				hmpb.AllBubbleBallotCycling,
			)
			if err != nil {
				log.Fatalln("all-bubble cycling ballot generation failed:", err)
			}
		}()

		wg.Add(1)
		go func() {
			defer wg.Done()

			file, err := os.Create(f.outdir + "/filled-ballot.pdf")
			if err != nil {
				log.Fatalln("unable to open all-bubble file for writing:", err)
			}
			defer file.Close()

			bufWriter := bufio.NewWriter(file)
			defer bufWriter.Flush()

			_, err = printer.BallotAllBubble(
				bufWriter,
				&hmpb.CfgAllBubble,
				f.paperSize,
				hmpb.AllBubbleBallotFilled,
			)
			if err != nil {
				log.Fatalln("all-bubble filled ballot generation failed:", err)
			}
		}()
	}

	// Grid-only sheets:
	for _, f := range []Fixture{
		{outdirGridOnlyCustom17, elections.PaperSizeCustom17, "en"},
		{outdirGridOnlyCustom19, elections.PaperSizeCustom19, "en"},
		{outdirGridOnlyCustom22, elections.PaperSizeCustom22, "en"},
		{outdirGridOnlyLegal, elections.PaperSizeLegal, "en"},
		{outdirGridOnlyLetter, elections.PaperSizeLetter, "en"},
	} {
		wg.Add(1)
		go func() {
			defer wg.Done()

			file, err := os.Create(f.outdir + "/standard.pdf")
			if err != nil {
				log.Fatalln("unable to open grid-only doc for writing:", err)
			}
			defer file.Close()

			bufWriter := bufio.NewWriter(file)
			defer bufWriter.Flush()

			err = printer.BallotGridOnly(bufWriter, &hmpb.CfgBase, f.paperSize)
			if err != nil {
				log.Fatalln("grid-only doc generation failed:", err)
			}
		}()
	}

	wg.Wait()

	fmt.Println("\n✅ Done:", time.Since(start))
}

func genBlankAndMarked(
	printer hmpb.Printer,
	cfg *hmpb.Cfg,
	election *elections.Election,
	style *elections.BallotStyle,
	precinctId string,
	votes elections.Votes,
	outdir string,
) {
	var blankRenderer *hmpb.Renderer
	var markedRenderer *hmpb.Renderer

	params := hmpb.PrintParams{
		NoCompress: true,
		PrecinctId: precinctId,
		StyleId:    style.Id,
		Type:       elections.BallotTypePrecinct,
	}

	var wg sync.WaitGroup
	chanElectionHash := make(chan []byte, 1)
	chanElectionHashHex := make(chan string, 1)

	wg.Add(1)
	go func() {
		defer wg.Done()

		var err error
		blankRenderer, err = printer.Ballot(election, params, cfg)
		assertNoErr(err)

		layout := blankRenderer.Layout()
		finalElection := *election
		finalElection.GridLayouts = []elections.GridLayout{}
		finalElection.GridLayouts = append(finalElection.GridLayouts, layout)

		electionJson, hash, err := finalElection.MarshalAndHash()
		assertNoErr(err)

		hashHex := hex.EncodeToString(hash[:])
		chanElectionHash <- hash[:]
		chanElectionHashHex <- hashHex

		fileBallot, err := os.Create(path.Join(outdir, "blank-ballot.pdf"))
		assertNoErr(err)
		defer fileBallot.Close()

		bufWriter := bufio.NewWriter(fileBallot)
		defer bufWriter.Flush()

		assertNoErr(blankRenderer.Finalize(bufWriter, hash[:], hashHex))
		assertNoErr(
			os.WriteFile(
				path.Join(outdir, "election.json"),
				electionJson,
				0o666,
			),
		)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()

		var err error
		markedRenderer, err = printer.Ballot(election, params, cfg)
		assertNoErr(err)

		markedRenderer.MarkVotes(votes)

		hash := <-chanElectionHash
		hashHex := <-chanElectionHashHex

		file, err := os.Create(path.Join(outdir, "marked-ballot.pdf"))
		assertNoErr(err)
		defer file.Close()

		bufWriter := bufio.NewWriter(file)
		defer bufWriter.Flush()

		assertNoErr(markedRenderer.Finalize(bufWriter, hash, hashHex))
	}()

	wg.Wait()
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

func mockVotes(filename string) (ballotStyleVotes map[string]elections.Votes) {
	file, err := os.Open(filename)
	if err != nil {
		log.Fatalln("unable to open mock votes JSON file for reading:", err)
	}

	reader := json.NewDecoder(file)

	err = reader.Decode(&ballotStyleVotes)
	if err != nil {
		log.Fatalln("unable to decode mock votes JSON:", err)
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

func assertNoErr(err error) {
	if err != nil {
		log.Fatalln(err)
	}
}
