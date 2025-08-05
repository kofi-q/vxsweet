package hmpb

import (
	"testing"

	"github.com/kofi-q/vxsweet/libs/elections"
	"github.com/stretchr/testify/require"
)

func TestEncodeMetadata(t *testing.T) {
	election := mockElection()
	encoded, err := EncodeMetadata(&election, Metadata{
		Hash: []byte{
			0x01, 0x23, 0x45, 0x67, 0x89, 0xab,
			0xcd, 0xef, 0x01, 0x23, 0x45, 0x67,
		},
		BallotStyleId: election.BallotStyles[1].Id,
		BallotType:    elections.BallotTypeAbsentee,
		Official:      false,
		PrecinctId:    election.Precincts[2].Id,
		PageCount:     16,
	})
	require.NoError(t, err)

	for i, pageEncoded := range encoded.Pages {
		pageNum := uint8(i + 1)
		require.Equal(t, []byte{
			// HMPB prelude:
			'V', 'P', 0x2,

			// Election hash
			0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23,

			// Start precinct index
			0b00000000,

			// End precinct index (5), start ballot style index (3)
			0b00010_000,

			// Continue ballot style index
			0b00000000,

			// End ballot style index (2), page num (5), test mode? (1)
			0b01_00000_1 | (pageNum << 1),

			// Ballot type index (4), ballot ID set? (1), padding (3)
			0b0001_0_000,
		}, pageEncoded)
	}
}
