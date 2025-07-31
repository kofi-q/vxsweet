package hmpb

import (
	"fmt"
	"io"
	"time"

	"github.com/kofi-q/vxsweet/libs/elections"
)

func (p *PrinterHmpb) BallotGridOnly(
	writer io.Writer,
	cfg *Cfg,
	size elections.PaperSize,
) error {
	r := renderer{
		cfg: cfg,
		election: &elections.Election{
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
		},
		printer: p,
		params: PrintParams{
			PrecinctId: "test-precinct",
			StyleId:    "sheet-1",
			Type:       elections.BallotTypePrecinct,
			Official:   true,
		},
	}

	err := r.renderGridOnly(writer)
	if err != nil {
		return err
	}

	return err
}

func (r *renderer) renderGridOnly(writer io.Writer) error {
	_, err := r.init()
	if err != nil {
		return err
	}

	r.bubbleOffsetY = 0
	r.pageAdd()
	r.lastPageNo = 2

	r.perf.header = time.Now()
	r.perf.candidates = time.Now()
	r.perf.measures = time.Now()
	r.perf.footers = time.Now()

	err = r.doc.Output(writer)

	fmt.Println(r.perf)

	return err
}
