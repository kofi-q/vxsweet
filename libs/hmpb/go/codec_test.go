package hmpb

import (
	"testing"

	"github.com/kofi-q/vxsweet/libs/elections"
	"github.com/stretchr/testify/require"
)

func TestEncodeMetadata(t *testing.T) {
	election = mockElection()
	encoded, err := EncodeMetadata(&election, Metadata{
		Hash:          "0123456789abcdef0123456789",
		BallotStyleId: election.BallotStyles[0].Id,
		BallotType:    elections.BallotTypeAbsentee,
		Official:      false,
		PrecinctId:    election.BallotStyles[0].Precincts[0],
		PageCount:     16,
	})
	require.NoError(t, err)

	// [TODO] decode and verify
	for _, pageEncoded := range encoded.Pages {
		require.Equal(t, "VP2", string(pageEncoded[0:3]))
		require.Equal(t, []byte{
			0b00000_000,
			0b01_00010_0,
			0b0011_0010,
			// ...
		}, pageEncoded[3:][0:3])
	}

}
