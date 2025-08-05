package hmpb

import (
	"encoding/hex"
	"fmt"
	"io"
	"slices"
	"strings"
	"time"

	"github.com/kofi-q/vxsweet/libs/elections"
)

func (p *PrinterHmpb) BallotAllBubble(
	writer io.Writer,
	cfg *Cfg,
	size elections.PaperSize,
) (*elections.Election, error) {
	election := elections.Election{
		BallotLayout: elections.BallotLayout{
			MetadataEncoding: elections.MetadataEncodingQr,
			PaperSize:        size,
		},
		BallotStyles: []elections.BallotStyle{{
			Districts: []string{"test-district"},
			GroupId:   "sheet-1",
			Id:        "sheet-1",
			Precincts: []string{"test-precinct"},
		}},
		County: elections.County{
			Id:   "test-county",
			Name: "Test County",
		},
		Districts: []elections.District{{
			Id:   "test-district",
			Name: "Test District",
		}},
		Key: elections.Key{
			Date: elections.Date{DateObj: elections.DateObj{
				Year:  2023,
				Month: 5,
				Day:   10,
			}},
			Id: "all-bubble-ballot-election",
		},
		Precincts: []elections.Precinct{{
			Id:   "test-precinct",
			Name: "Test Precinct",
		}},
		State:   "Test State",
		Strings: elections.UiStringsPackage{"en": StringCatalog},
		Title:   "Test Election - All Bubble Ballot",
		Type:    elections.ElectionTypeGeneral,
	}

	r := renderer{
		cfg:      cfg,
		election: &election,
		printer:  p,
		params: PrintParams{
			PrecinctId: "test-precinct",
			StyleId:    "sheet-1",
			Type:       elections.BallotTypePrecinct,
			Official:   true,
		},
	}

	err := r.renderAllBubble(writer)
	if err != nil {
		return nil, err
	}

	layout := r.Layout()
	election.GridLayouts = append(election.GridLayouts, layout)
	slices.SortFunc(
		election.GridLayouts,
		func(a, b elections.GridLayout) int {
			return strings.Compare(a.BallotStyleId, b.BallotStyleId)
		},
	)

	return &election, nil
}

func (r *renderer) renderAllBubble(writer io.Writer) error {
	_, err := r.init()
	if err != nil {
		return err
	}

	r.bubbleOffsetY = 0
	r.pageAdd()
	r.lastPageNo = 2

	if logPerf {
		r.perf.header = time.Now()
	}

	for i := range 2 {
		r.doc.SetPage(i + 1)

		contest := elections.Contest{
			CandidateContest: elections.CandidateContest{
				Candidates: []elections.Candidate{},
			},
			DistrictId: "test-district",
			Id:         fmt.Sprintf("page-%d", i+1),
			Title:      fmt.Sprintf("Test Contest - Page %d", i+1),
			Type:       elections.ContestTypeCandidate,
		}

		y := 1
		const footerGridHeight = 2
		for range int(r.gridCellCount.Y()) - 2 - footerGridHeight {
			x := 1
			for range int(r.gridCellCount.X()) - 2 {
				id := fmt.Sprintf("p%d-r%d-c%d", i+1, x, y)
				contest.Candidates = append(
					contest.Candidates,
					elections.Candidate{
						Id: id,
						Name: fmt.Sprintf(
							"Page-%d Row-%d Col-%d",
							i+1, x, y,
						),
					},
				)

				r.bubbleOption(
					r.fromGrid(Vec2{float32(x), float32(y)}).Sub(
						r.cfg.BubbleSize.
							Add(Vec2{bubbleLnWidth, bubbleLnWidth}).
							Mul(Vec2{0.5, 0.5}),
					),
					&contest,
					id,
				)

				x += 1
			}

			y += 1
		}

		r.election.Contests = append(r.election.Contests, contest)
	}

	if logPerf {
		r.perf.candidates = time.Now()
		r.perf.measures = time.Now()
	}

	_, hash, err := r.election.MarshalAndHash()
	if err != nil {
		return err
	}

	return r.Finalize(writer, hash[:], hex.EncodeToString(hash[:]))
}
