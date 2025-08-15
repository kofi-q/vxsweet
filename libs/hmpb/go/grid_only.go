package hmpb

import (
	"io"

	"github.com/kofi-q/vxsweet/libs/elections"
)

func (p *PrinterHmpb) BallotGridOnly(
	writer io.Writer,
	cfg *Cfg,
	size elections.PaperSize,
) error {
	r := Renderer{
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

func (r *Renderer) renderGridOnly(writer io.Writer) error {
	_, err := r.init()
	if err != nil {
		return err
	}

	r.bubbleOffsetY = 0
	r.pageAdd()
	r.lastPageNo = 2

	return r.doc.Output(writer)
}
