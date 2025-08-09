package hmpb

import (
	"bufio"
	"encoding/hex"
	"errors"
	"fmt"
	"os"
	"path"
	"slices"
	"strings"
	"sync"
	"time"

	"github.com/kofi-q/vxsweet/libs/elections"
)

type Packager struct {
	BallotTypes []elections.BallotType
	Cfg         *Cfg
	Election    *elections.Election
	jobs        []PrintParams
	OutDir      string
	Printer     Printer
}

type Package struct {
	Definition elections.Definition
	Ballots    []GeneratedBallot
}

type GeneratedBallot struct {
	Path       string
	PrecinctId string
	StyleId    string
}

var (
	AllBallotTypes = []elections.BallotType{
		elections.BallotTypeAbsentee,
		elections.BallotTypePrecinct,
		elections.BallotTypeProvisional,
	}
)

func (p *Packager) All() (Package, error) {
	var errs []error
	renderers := []*Renderer{}

	if p.BallotTypes == nil {
		p.BallotTypes = AllBallotTypes
	}

	for _, style := range p.Election.BallotStyles {
		for _, precinctId := range style.Precincts {
			for _, typ := range p.BallotTypes {
				p.jobs = append(p.jobs, PrintParams{
					PrecinctId: precinctId,
					StyleId:    style.Id,
					Type:       typ,
					NoCompress: true,
					Official:   true,
				})
				p.jobs = append(p.jobs, PrintParams{
					PrecinctId: precinctId,
					StyleId:    style.Id,
					Type:       typ,
					NoCompress: true,
					Official:   false,
				})
			}
		}
	}

	chanErrs := make(chan error)
	chanRenderers := make(chan *Renderer)
	var wg sync.WaitGroup

	for _, job := range p.jobs {
		wg.Add(1)
		go func() {
			defer wg.Done()

			r, err := p.Printer.Ballot(p.Election, job, p.Cfg)
			if err != nil {
				chanErrs <- err
				return
			}

			chanRenderers <- r
		}()
	}

	done := make(chan struct{})

	go func() {
		for {
			select {
			case <-done:
				return
			case err := <-chanErrs:
				errs = append(errs, err)
			case r := <-chanRenderers:
				renderers = append(renderers, r)
			}
		}
	}()

	wg.Wait()
	done <- struct{}{}
	close(chanRenderers)

	if len(errs) > 0 {
		return Package{}, errors.Join(errs...)
	}

	if len(p.jobs) > 1000 {
		// Break for garbage collection on large elections.
		time.Sleep(500 * time.Millisecond)
	}

	finalElection := *p.Election
	finalElection.GridLayouts = []elections.GridLayout{}
	for _, r := range renderers {
		layout := r.Layout()

		if slices.ContainsFunc(
			finalElection.GridLayouts,
			func(l elections.GridLayout) bool {
				return l.BallotStyleId == layout.BallotStyleId
			},
		) {
			continue
		}

		finalElection.GridLayouts = append(finalElection.GridLayouts, layout)
	}

	slices.SortFunc(
		finalElection.GridLayouts,
		func(a, b elections.GridLayout) int {
			return strings.Compare(a.BallotStyleId, b.BallotStyleId)
		},
	)

	electionJson, hash, err := finalElection.MarshalAndHash()
	if err != nil {
		return Package{}, err
	}
	hashHex := hex.EncodeToString(hash[:])

	ballots := make([]GeneratedBallot, 0, len(p.jobs))
	for _, r := range renderers {
		precinct := p.Election.Precinct(r.PrecinctId())
		outPath := path.Join(p.OutDir, fmt.Sprintf(
			"%s-%s-ballot-%s-%s.pdf",
			r.BallotMode(),
			r.BallotType(),
			strings.ReplaceAll(precinct.Name, " ", "-"),
			r.StyleId(),
		))
		ballots = append(ballots, GeneratedBallot{
			Path:       outPath,
			PrecinctId: r.PrecinctId(),
			StyleId:    r.StyleId(),
		})

		wg.Add(1)
		go func() {
			defer wg.Done()

			file, err := os.Create(outPath)
			if err != nil {
				chanErrs <- err
			}
			defer file.Close()

			bufWriter := bufio.NewWriter(file)
			if err = r.Finalize(bufWriter, hash[:], hashHex); err != nil {
				chanErrs <- err
				return
			}
			if err = bufWriter.Flush(); err != nil {
				chanErrs <- err
			}
		}()
	}

	go func() {
		for {
			select {
			case <-done:
				return
			case err := <-chanErrs:
				errs = append(errs, err)
			}
		}
	}()

	go func() {
		err = os.WriteFile(
			path.Join(p.OutDir, "election.json"),
			electionJson,
			0o666,
		)
		if err != nil {
			chanErrs <- err
		}
	}()

	wg.Wait()
	done <- struct{}{}
	close(chanErrs)

	if len(errs) > 0 {
		return Package{}, errors.Join(errs...)
	}

	return Package{
		Ballots: ballots,
		Definition: elections.Definition{
			Election:     finalElection,
			ElectionData: electionJson,
			Hash:         hashHex,
		},
	}, nil
}
