package hmpb

import (
	"encoding/hex"
	"fmt"
	"io"
	"time"

	"github.com/kofi-q/vxsweet/libs/elections"
)

type AllBubbleBallotMode uint8

const (
	AllBubbleBallotBlank AllBubbleBallotMode = iota
	AllBubbleBallotCycling
	AllBubbleBallotFilled
)

func (p *PrinterHmpb) BallotAllBubble(
	writer io.Writer,
	cfg *Cfg,
	size elections.PaperSize,
	mode AllBubbleBallotMode,
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
		Contests: make([]elections.Contest, 0, 2),
		County: elections.County{
			Id:   "test-county",
			Name: "Test County",
		},
		Districts: []elections.District{{
			Id:   "test-district",
			Name: "Test District",
		}},
		GridLayouts: make([]elections.GridLayout, 0, 1),
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

	r := Renderer{
		cfg:      cfg,
		election: &election,
		printer:  p,
		params: PrintParams{
			Official:   true,
			PrecinctId: "test-precinct",
			StyleId:    "sheet-1",
			Type:       elections.BallotTypePrecinct,
		},
	}

	err := r.renderAllBubble(mode)
	if err != nil {
		return nil, err
	}

	layout := r.Layout()
	election.GridLayouts = append(election.GridLayouts, layout)

	_, hash, err := election.MarshalAndHash()
	if err != nil {
		return nil, err
	}

	err = r.Finalize(writer, hash[:], hex.EncodeToString(hash[:]))
	if err != nil {
		return nil, err
	}

	return &election, nil
}

func (r *Renderer) renderAllBubble(mode AllBubbleBallotMode) error {
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

		const footerGridHeight = 2
		rowCount := int(r.gridCellCount.Y()) - 2 - footerGridHeight
		colCount := int(r.gridCellCount.X()) - 2

		contest := elections.Contest{
			CandidateContest: elections.CandidateContest{
				Candidates: make([]elections.Candidate, 0, rowCount*colCount),
			},
			DistrictId: "test-district",
			Id:         fmt.Sprintf("page-%d", i+1),
			Title:      fmt.Sprintf("Test Contest - Page %d", i+1),
			Type:       elections.ContestTypeCandidate,
		}

		y := 1
		for range rowCount {
			x := 1
			for range colCount {
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

				pos := r.fromGrid(Vec2{float32(x), float32(y)}).Sub(
					r.cfg.BubbleSize.
						Add(Vec2{bubbleLnWidth, bubbleLnWidth}).
						Mul(Vec2{0.5, 0.5}),
				)

				switch mode {
				case AllBubbleBallotBlank:
					r.bubbleOption(pos, &contest, id)

				case AllBubbleBallotCycling:
					if (x-y)%6 == 0 {
						r.bubbleOptionFilled(pos, &contest, id)
					} else {
						r.bubbleOption(pos, &contest, id)
					}

				case AllBubbleBallotFilled:
					r.bubbleOptionFilled(pos, &contest, id)
				}

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

	return nil
}
