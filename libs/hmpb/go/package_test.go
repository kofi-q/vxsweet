package hmpb

import (
	_ "embed"
	"fmt"
	"testing"
	"time"

	"github.com/kofi-q/vxsweet/libs/elections"
	"github.com/stretchr/testify/require"
)

func TestPackageAll(t *testing.T) {
	printer := NewPrinterHmpb()
	startTotal := time.Now()

	style := election.BallotStyles[0]

	packager := Packager{
		Cfg:      &CfgBase,
		Election: &election,
		jobs: []PrintParams{{
			Official:   true,
			PrecinctId: style.Precincts[0],
			StyleId:    style.Id,
			Type:       elections.BallotTypeAbsentee,
		}, {
			Official:   true,
			PrecinctId: style.Precincts[0],
			StyleId:    style.Id,
			Type:       elections.BallotTypePrecinct,
		}},
		Printer: &printer,
	}
	pkg, err := packager.All()
	require.NoError(t, err)

	fmt.Println("TOTAL TIME:", time.Since(startTotal))
	fmt.Println("Ballot count:", len(pkg.Ballots))
}
